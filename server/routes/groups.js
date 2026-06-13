import express from 'express';
import prisma from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all groups the current user belongs to
router.get('/', authenticateToken, async (req, res) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const groups = memberships.map((m) => m.group);
    res.json(groups);
  } catch (error) {
    console.error('Fetch groups error:', error);
    res.status(500).json({ error: 'Server error fetching groups' });
  }
});

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const newGroup = await prisma.group.create({
      data: {
        name,
        description,
        createdById: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'admin',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error creating group' });
  }
});

// Get group by ID (if user is a member)
router.get('/:id', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);

  try {
    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.id,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not authorized to view this group' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        expenses: {
          orderBy: { date: 'desc' },
          include: {
            payer: {
              select: { id: true, name: true, email: true },
            },
            splits: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    });

    res.json(group);
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Server error fetching group details' });
  }
});

// Add a member to a group
router.post('/:id/members', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const { userId, email } = req.body; // Can add by userId or by email invite

  try {
    // Check if current user is member of the group
    const callerMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.id,
        },
      },
    });

    if (!callerMembership) {
      return res.status(403).json({ error: 'Only members can add users to this group' });
    }

    let targetUser;

    if (userId) {
      targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    } else if (email) {
      targetUser = await prisma.user.findUnique({ where: { email } });
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existingMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }

    const newMember = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUser.id,
        role: 'member',
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

    res.status(201).json(newMember);
  } catch (error) {
    console.error('Add group member error:', error);
    res.status(500).json({ error: 'Server error adding member' });
  }
});

// Remove a member from a group (must be group admin, or the user removing themselves)
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  const groupId = parseInt(req.params.id);
  const targetUserId = parseInt(req.params.userId);

  try {
    // Check caller's membership
    const callerMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.id,
        },
      },
    });

    if (!callerMembership) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if caller is removing themselves or caller is admin
    const canDelete = req.user.id === targetUserId || callerMembership.role === 'admin';
    if (!canDelete) {
      return res.status(403).json({ error: 'Only group admins can remove other members' });
    }

    // Delete membership
    await prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: targetUserId,
        },
      },
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error removing member' });
  }
});

export default router;
