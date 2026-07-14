const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const InterestRequest = require('./models/InterestRequest');
const ChatMessage = require('./models/ChatMessage');
const { buildChatSessionId } = require('./models/ChatMessage');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  // ─── JWT Auth Middleware ───────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.userId, role: decoded.role };
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  // ─── Connection Handler ────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[socket] User connected: ${socket.user.id}`);

    // ── join_chat ────────────────────────────────────────────────────────────
    socket.on('join_chat', async ({ requestId }) => {
      try {
        const request = await InterestRequest.findById(requestId);
        if (!request) {
          socket.emit('error', { message: 'Interest request not found' });
          return;
        }

        const userId = socket.user.id;
        if (
          request.tenantId.toString() !== userId &&
          request.ownerId.toString() !== userId
        ) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const roomName = buildChatSessionId(request.tenantId, request.ownerId);
        socket.join(roomName);
        console.log(`[socket] User ${userId} joined room: ${roomName}`);
      } catch (err) {
        console.error('[socket] join_chat error:', err.message);
        socket.emit('error', { message: 'Server error joining chat' });
      }
    });

    // ── send_message ─────────────────────────────────────────────────────────
    socket.on('send_message', async ({ requestId, text }) => {
      try {
        if (!text || text.length > 2000) {
          socket.emit('error', { message: 'Message too long' });
          return;
        }

        const request = await InterestRequest.findById(requestId);
        if (!request) {
          socket.emit('error', { message: 'Interest request not found' });
          return;
        }

        const userId = socket.user.id;
        const tenantId = request.tenantId.toString();
        const ownerId = request.ownerId.toString();

        if (userId !== tenantId && userId !== ownerId) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Determine receiver
        const receiverId = userId === tenantId ? ownerId : tenantId;

        const chatSessionId = buildChatSessionId(request.tenantId, request.ownerId);

        // Persist message
        const message = await ChatMessage.create({
          chatSessionId,
          senderId: userId,
          receiverId,
          text,
        });

        // Broadcast to all sockets in the room
        io.to(chatSessionId).emit('receive_message', {
          chatSessionId,
          senderId: userId,
          text,
          createdAt: message.createdAt,
        });
      } catch (err) {
        console.error('[socket] send_message error:', err.message);
        socket.emit('error', { message: 'Server error sending message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[socket] User disconnected: ${socket.user.id}`);
    });
  });

  return io;
}

module.exports = initSocket;
