const express = require('express');
const verifyToken = require('../middleware/auth');
const InterestRequest = require('../models/InterestRequest');
const ChatMessage = require('../models/ChatMessage');
const { buildChatSessionId } = require('../models/ChatMessage');

const router = express.Router();

// ─── GET /api/chat/:requestId/messages — fetch chat history ─────────────────
router.get('/:requestId/messages', verifyToken, async (req, res, next) => {
  try {
    const request = await InterestRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Interest request not found', details: {} });
    }

    // Only tenant or owner of this request may access the chat
    const userId = req.user.id;
    if (
      request.tenantId.toString() !== userId &&
      request.ownerId.toString() !== userId
    ) {
      return res.status(403).json({ error: 'Forbidden: not your chat session', details: {} });
    }

    const chatSessionId = buildChatSessionId(request.tenantId, request.ownerId);

    const messages = await ChatMessage.find({ chatSessionId })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
