import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to round to 2 decimal places
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Create a new expense
router.post('/', authenticateToken, async (req, res) => {
  const { groupId, description, amount: rawAmount, paidById, date, splitType, splits } = req.body;

  if (!description || !rawAmount || !paidById || !splitType || !splits || splits.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    // Check if group exists and caller is member (if groupId is provided)
    if (groupId) {
      const parsedGroupId = parseInt(groupId);
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: parsedGroupId,
            userId: req.user.id,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this group' });
      }
    }

    let calculatedSplits = [];
    const numUsers = splits.length;

    if (splitType === 'EQUAL') {
      const equalShare = round2(amount / numUsers);
      let totalAssigned = 0;

      calculatedSplits = splits.map((s, idx) => {
        let owed = equalShare;
        if (idx === 0) {
          // Put the rounding difference in the first split
          owed = round2(amount - equalShare * (numUsers - 1));
        }
        return {
          userId: parseInt(s.userId),
          owedAmount: owed,
        };
      });
    } else if (splitType === 'UNEQUAL') {
      let sum = 0;
      calculatedSplits = splits.map((s) => {
        const owed = round2(parseFloat(s.owedAmount));
        sum += owed;
        return {
          userId: parseInt(s.userId),
          owedAmount: owed,
        };
      });

      if (Math.abs(sum - amount) > 0.02) {
        return res.status(400).json({ error: `Sum of unequal splits (${sum}) must equal total amount (${amount})` });
      }
    } else if (splitType === 'PERCENTAGE') {
      let sumPercentage = 0;
      let totalAssigned = 0;

      calculatedSplits = splits.map((s, idx) => {
        const pct = parseFloat(s.percentageValue);
        sumPercentage += pct;
        let owed = round2((amount * pct) / 100);
        
        if (idx === numUsers - 1) {
          // Adjust last to match exactly due to rounding
          owed = round2(amount - totalAssigned);
        } else {
          totalAssigned += owed;
        }

        return {
          userId: parseInt(s.userId),
          percentageValue: pct,
          owedAmount: owed,
        };
      });

      if (Math.abs(sumPercentage - 100) > 0.01) {
        return res.status(400).json({ error: `Sum of percentages (${sumPercentage}%) must equal 100%` });
      }
    } else if (splitType === 'SHARE') {
      const totalShares = splits.reduce((acc, s) => acc + parseFloat(s.shareValue || 0), 0);
      if (totalShares <= 0) {
        return res.status(400).json({ error: 'Total shares must be greater than 0' });
      }

      let totalAssigned = 0;
      calculatedSplits = splits.map((s, idx) => {
        const share = parseFloat(s.shareValue);
        let owed = round2((amount * share) / totalShares);

        if (idx === numUsers - 1) {
          // Adjust last to match exactly due to rounding
          owed = round2(amount - totalAssigned);
        } else {
          totalAssigned += owed;
        }

        return {
          userId: parseInt(s.userId),
          shareValue: share,
          owedAmount: owed,
        };
      });
    } else {
      return res.status(400).json({ error: 'Invalid split type' });
    }

    // Use Prisma transaction to create expense and its splits
    const expense = await prisma.$transaction(async (tx) => {
      const newExpense = await tx.expense.create({
        data: {
          groupId: groupId ? parseInt(groupId) : null,
          description,
          amount,
          paidById: parseInt(paidById),
          date: date ? new Date(date) : new Date(),
          splitType,
        },
      });

      const splitData = calculatedSplits.map((cs) => ({
        expenseId: newExpense.id,
        userId: cs.userId,
        owedAmount: cs.owedAmount,
        percentageValue: cs.percentageValue || null,
        shareValue: cs.shareValue || null,
      }));

      await tx.expenseSplit.createMany({
        data: splitData,
      });

      return tx.expense.findUnique({
        where: { id: newExpense.id },
        include: {
          payer: { select: { id: true, name: true, email: true } },
          splits: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });

    res.status(201).json(expense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Server error creating expense' });
  }
});

// Delete an expense
router.delete('/:id', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.id);

  try {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Check if user is payer or a member of the group
    if (expense.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: expense.groupId,
            userId: req.user.id,
          },
        },
      });
      if (!membership) {
        return res.status(403).json({ error: 'Not authorized to delete this expense' });
      }
    } else {
      // Direct expense: only the payer or splits participant can delete
      const splits = await prisma.expenseSplit.findMany({
        where: { expenseId },
      });
      const isParticipant = splits.some((s) => s.userId === req.user.id);
      if (expense.paidById !== req.user.id && !isParticipant) {
        return res.status(403).json({ error: 'Not authorized to delete this expense' });
      }
    }

    await prisma.expense.delete({
      where: { id: expenseId },
    });

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Server error deleting expense' });
  }
});

// Get expense details by ID
router.get('/:id', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.id);

  try {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        payer: { select: { id: true, name: true, email: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Fetch expense details error:', error);
    res.status(500).json({ error: 'Server error fetching expense details' });
  }
});

export default router;
