const mongoose = require('mongoose');

/**
 * buildChatSessionId — sorts tenantId and ownerId strings and joins with '_'
 * so the same session ID is produced regardless of which party initiates.
 */
function buildChatSessionId(tenantId, ownerId) {
  return [tenantId.toString(), ownerId.toString()].sort().join('_');
}

const chatMessageSchema = new mongoose.Schema({
  chatSessionId: {
    type: String,
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: [2000, 'Message too long'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient history queries sorted by time
chatMessageSchema.index({ chatSessionId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;
module.exports.buildChatSessionId = buildChatSessionId;
