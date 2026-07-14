const express = require('express');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const User = require('../models/User');
const RoomListing = require('../models/RoomListing');
const InterestRequest = require('../models/InterestRequest');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

// Guard all admin routes
router.use(verifyToken, requireRole('admin'));

// ─── GET /api/admin/users — all users (no passwordHash) ───────────────────────
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/admin/users/:id — soft-delete or reactivate ───────────────────
router.patch('/users/:id', async (req, res, next) => {
  try {
    const { isDeleted } = req.body;
    if (typeof isDeleted !== 'boolean') {
      return res.status(400).json({
        error: 'isDeleted must be a boolean',
        details: { isDeleted: 'must be true or false' },
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isDeleted },
      { new: true, select: '-passwordHash' }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found', details: {} });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/listings — all listings (all statuses) ────────────────────
router.get('/listings', async (req, res, next) => {
  try {
    const listings = await RoomListing.find({})
      .populate('ownerId', 'name email')
      .sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/admin/listings/:id — soft-delete listing ─────────────────────
router.delete('/listings/:id', async (req, res, next) => {
  try {
    const listing = await RoomListing.findByIdAndUpdate(
      req.params.id,
      { status: 'deleted' },
      { new: true }
    );
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }
    res.json({ message: 'Listing deleted', id: listing._id });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/metrics — platform metrics ────────────────────────────────
router.get('/metrics', async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [usersByRole, activeListings, interestByStatus, messagesLast30Days] =
      await Promise.all([
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } },
        ]),
        RoomListing.countDocuments({ status: 'available' }),
        InterestRequest.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        ChatMessage.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      ]);

    // Reformat aggregation results into plain objects
    const usersByRoleObj = Object.fromEntries(
      usersByRole.map((u) => [u._id, u.count])
    );
    const interestByStatusObj = Object.fromEntries(
      interestByStatus.map((i) => [i._id, i.count])
    );

    res.json({
      usersByRole: usersByRoleObj,
      activeListings,
      interestByStatus: interestByStatusObj,
      messagesLast30Days,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
