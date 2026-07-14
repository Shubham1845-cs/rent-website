const mongoose = require('mongoose');

const roomListingSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    maxlength: [200, 'Location must not exceed 200 characters'],
    trim: true,
  },
  rent: {
    type: Number,
    required: [true, 'Rent is required'],
    min: [0, 'Rent must be non-negative'],
  },
  availableFrom: {
    type: Date,
    required: [true, 'Available from date is required'],
  },
  roomType: {
    type: String,
    enum: ['single', 'double', 'studio'],
    required: [true, 'Room type is required'],
  },
  furnishing: {
    type: String,
    enum: ['furnished', 'unfurnished', 'partial'],
    required: [true, 'Furnishing status is required'],
  },
  photos: {
    type: [String],
    validate: {
      validator: (arr) => arr.length <= 10,
      message: 'Maximum 10 photos allowed',
    },
    default: [],
  },
  status: {
    type: String,
    enum: ['available', 'filled', 'deleted'],
    default: 'available',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('RoomListing', roomListingSchema);
