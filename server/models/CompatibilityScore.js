const mongoose = require('mongoose');

const compatibilityScoreSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RoomListing',
    required: true,
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  explanation: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    enum: ['llm', 'fallback'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index — one score per (tenant, listing) pair
compatibilityScoreSchema.index({ tenantId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('CompatibilityScore', compatibilityScoreSchema);
