import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get comments for an expense
router.get('/expense/:expenseId', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.expenseId);

  try {
    const comments = await prisma.expenseComment.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(comments);
  } catch (error) {
    console.error('Fetch comments error:', error);
    res.status(500).json({ error: 'Server error fetching comments' });
  }
});

// Post a comment via HTTP (REST fallback)
router.post('/expense/:expenseId', authenticateToken, async (req, res) => {
  const expenseId = parseInt(req.params.expenseId);
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const comment = await prisma.expenseComment.create({
      data: {
        expenseId,
        userId: req.user.id,
        message,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Server error posting comment' });
  }
});

export default router;
