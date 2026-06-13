import { Server } from 'socket.io';
import prisma from './db.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for simplicity
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join expense chat room
    socket.on('join_expense', ({ expenseId }) => {
      const room = `expense_${expenseId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    // Leave expense chat room
    socket.on('leave_expense', ({ expenseId }) => {
      const room = `expense_${expenseId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
    });

    // Send a message inside an expense
    socket.on('send_message', async ({ expenseId, userId, message }) => {
      try {
        const room = `expense_${expenseId}`;

        // Save to DB
        const comment = await prisma.expenseComment.create({
          data: {
            expenseId: parseInt(expenseId),
            userId: parseInt(userId),
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

        // Broadcast to everyone in the room
        io.to(room).emit('new_message', comment);
      } catch (error) {
        console.error('Error saving or broadcasting socket comment:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
