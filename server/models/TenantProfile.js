const mongoose = require('mongoose');

const tenantProfileSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  preferredLocation: {
    type: String,
    required: [true, 'Preferred location is required'],
    maxlength: [200, 'Preferred location must not exceed 200 characters'],
    trim: true,
  },
  budgetMin: {
    type: Number,
    required: [true, 'Minimum budget is required'],
    min: [0, 'Budget must be non-negative'],
  },
  budgetMax: {
    type: Number,
    required: [true, 'Maximum budget is required'],
    min: [0, 'Budget must be non-negative'],
  },
  moveInDate: {
    type: Date,
    required: [true, 'Move-in date is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('TenantProfile', tenantProfileSchema);
