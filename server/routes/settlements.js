import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to round to 2 decimal places
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Record a settlement / payment
router.post('/', authenticateToken, async (req, res) => {
  const { groupId, fromUserId, toUserId, amount: rawAmount, date } = req.body;

  if (!fromUserId || !toUserId || !rawAmount) {
    return res.status(400).json({ error: 'fromUserId, toUserId, and amount are required' });
  }

  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const settlement = await prisma.settlement.create({
      data: {
        groupId: groupId ? parseInt(groupId) : null,
        fromUserId: parseInt(fromUserId),
        toUserId: parseInt(toUserId),
        amount,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
        toUser: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json(settlement);
  } catch (error) {
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Server error recording settlement' });
  }
});

// Delete a settlement
router.delete('/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const settlement = await prisma.settlement.findUnique({ where: { id } });
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    if (settlement.fromUserId !== req.user.id && settlement.toUserId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to delete this settlement' });
    }

    await prisma.settlement.delete({ where: { id } });
    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('Delete settlement error:', error);
    res.status(500).json({ error: 'Server error deleting settlement' });
  }
});

// Get individual balance summary across all groups
router.get('/balances', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Get all expenses where user paid or user owes
    const expensesPaid = await prisma.expense.findMany({
      where: { paidById: userId },
      include: { splits: true },
    });

    const expenseSplits = await prisma.expenseSplit.findMany({
      where: { userId },
      include: { expense: true },
    });

    // 2. Get all settlements
    const settlementsSent = await prisma.settlement.findMany({
      where: { fromUserId: userId },
    });

    const settlementsReceived = await prisma.settlement.findMany({
      where: { toUserId: userId },
    });

    // 3. We want to compile net balances per other user.
    // userBalances structure: { [otherUserId]: { name, email, netBalance } }
    const userBalances = {};

    // Helper to get or init user record in memory
    const getOrInitUser = async (id) => {
      if (userBalances[id]) return userBalances[id];
      const otherUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true },
      });
      userBalances[id] = {
        id: otherUser.id,
        name: otherUser.name,
        email: otherUser.email,
        netBalance: 0,
      };
      return userBalances[id];
    };

    // Calculate from expenses paid by the current user
    for (const exp of expensesPaid) {
      for (const split of exp.splits) {
        if (split.userId !== userId) {
          const other = await getOrInitUser(split.userId);
          other.netBalance += parseFloat(split.owedAmount); // They owe me
        }
      }
    }

    // Calculate from expenses where the current user owes
    for (const split of expenseSplits) {
      const exp = split.expense;
      if (exp.paidById !== userId) {
        const other = await getOrInitUser(exp.paidById);
        other.netBalance -= parseFloat(split.owedAmount); // I owe them
      }
    }

    // Adjust for settlements sent by current user
    for (const set of settlementsSent) {
      const other = await getOrInitUser(set.toUserId);
      other.netBalance += parseFloat(set.amount); // I paid them, reducing my debt (moves balance positive)
    }

    // Adjust for settlements received by current user
    for (const set of settlementsReceived) {
      const other = await getOrInitUser(set.fromUserId);
      other.netBalance -= parseFloat(set.amount); // They paid me, reducing their debt (moves balance negative)
    }

    // Calculate summary statistics
    let totalOwed = 0;
    let totalOwedToYou = 0;
    const balancesList = [];

    for (const key of Object.keys(userBalances)) {
      const item = userBalances[key];
      item.netBalance = round2(item.netBalance);
      if (Math.abs(item.netBalance) > 0.01) {
        if (item.netBalance > 0) {
          totalOwedToYou += item.netBalance;
        } else {
          totalOwed += Math.abs(item.netBalance);
        }
        balancesList.push(item);
      }
    }

    const netBalance = round2(totalOwedToYou - totalOwed);

    res.json({
      netBalance,
      totalOwed: round2(totalOwed),
      totalOwedToYou: round2(totalOwedToYou),
      balancesByUser: balancesList,
    });
  } catch (error) {
    console.error('Fetch individual balances error:', error);
    res.status(500).json({ error: 'Server error calculating balances' });
  }
});

// Get group-specific balances and simplified debts
router.get('/groups/:groupId/balances', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.groupId);
  const userId = req.user.id;

  try {
    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to view balances for this group' });
    }

    // Fetch group members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Fetch all expenses in group
    const expenses = await prisma.expense.findMany({
      where: { groupId },
      include: { splits: true },
    });

    // Fetch all settlements in group
    const settlements = await prisma.settlement.findMany({
      where: { groupId },
    });

    // 1. Initialize member net balances
    // memberBalances: { [userId]: netBalance }
    const memberBalances = {};
    const memberInfo = {};
    members.forEach((m) => {
      memberBalances[m.userId] = 0;
      memberInfo[m.userId] = m.user;
    });

    // 2. Add credits/debits from expenses
    expenses.forEach((exp) => {
      const payerId = exp.paidById;
      const totalAmt = parseFloat(exp.amount);

      // Payer paid totalAmt, so they are credited (balance goes up)
      if (memberBalances[payerId] !== undefined) {
        memberBalances[payerId] += totalAmt;
      }

      // Each split participant is debited (balance goes down)
      exp.splits.forEach((split) => {
        if (memberBalances[split.userId] !== undefined) {
          memberBalances[split.userId] -= parseFloat(split.owedAmount);
        }
      });
    });

    // 3. Add credits/debits from settlements
    settlements.forEach((set) => {
      const fromId = set.fromUserId;
      const toId = set.toUserId;
      const amt = parseFloat(set.amount);

      // Sender sent money (paid back), so their balance goes up
      if (memberBalances[fromId] !== undefined) {
        memberBalances[fromId] += amt;
      }
      // Receiver received money, so their balance goes down (they got settled)
      if (memberBalances[toId] !== undefined) {
        memberBalances[toId] -= amt;
      }
    });

    // Map output for member balances
    const groupBalances = Object.keys(memberBalances).map((key) => {
      const uId = parseInt(key);
      return {
        user: memberInfo[uId],
        netBalance: round2(memberBalances[uId]),
      };
    });

    // 4. Simplify debts algorithm (greedy matching of debtors and creditors)
    const balances = Object.keys(memberBalances).map((key) => ({
      userId: parseInt(key),
      balance: round2(memberBalances[key]),
    }));

    const debtors = balances.filter((b) => b.balance < -0.01).sort((a, b) => a.balance - b.balance); // Most negative first
    const creditors = balances.filter((b) => b.balance > 0.01).sort((a, b) => b.balance - a.balance); // Most positive first

    const simplifiedDebts = [];

    let dIdx = 0;
    let cIdx = 0;

    // Deep copy balances to modify them
    const tempDebtors = debtors.map((d) => ({ ...d }));
    const tempCreditors = creditors.map((c) => ({ ...c }));

    while (dIdx < tempDebtors.length && cIdx < tempCreditors.length) {
      const debtor = tempDebtors[dIdx];
      const creditor = tempCreditors[cIdx];

      const debtAmount = Math.min(Math.abs(debtor.balance), creditor.balance);
      const roundedDebt = round2(debtAmount);

      if (roundedDebt > 0.01) {
        simplifiedDebts.push({
          fromUser: memberInfo[debtor.userId],
          toUser: memberInfo[creditor.userId],
          amount: roundedDebt,
        });
      }

      debtor.balance += roundedDebt;
      creditor.balance -= roundedDebt;

      if (Math.abs(debtor.balance) < 0.01) {
        dIdx++;
      }
      if (Math.abs(creditor.balance) < 0.01) {
        cIdx++;
      }
    }

    res.json({
      groupBalances,
      simplifiedDebts,
    });
  } catch (error) {
    console.error('Fetch group balances error:', error);
    res.status(500).json({ error: 'Server error calculating group balances' });
  }
});

export default router;
