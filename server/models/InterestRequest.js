const mongoose = require('mongoose');

const interestRequestSchema = new mongoose.Schema({
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
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  scoreAtRequest: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index — one request per (tenant, listing) pair
interestRequestSchema.index({ tenantId: 1, listingId: 1 }, { unique: true });

module.exports = mongoose.model('InterestRequest', interestRequestSchema);
