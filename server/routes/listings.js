const express = require('express');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const upload = require('../middleware/upload');
const RoomListing = require('../models/RoomListing');
const CompatibilityScore = require('../models/CompatibilityScore');
const TenantProfile = require('../models/TenantProfile');
const { getOrComputeScores } = require('../services/scoringService');

const router = express.Router();

// ─── GET /api/listings — browse listings with scoring (tenant) ────────────────
router.get('/', verifyToken, requireRole('tenant'), async (req, res, next) => {
  try {
    const profile = await TenantProfile.findOne({ tenantId: req.user.id });
    if (!profile) {
      return res.status(400).json({
        error: 'Please complete your profile before browsing listings',
        details: {},
      });
    }

    // Build query — exclude filled and deleted
    const query = { status: 'available' };

    if (req.query.location) {
      query.location = { $regex: req.query.location, $options: 'i' };
    }
    if (req.query.budgetMin || req.query.budgetMax) {
      query.rent = {};
      if (req.query.budgetMin) query.rent.$gte = Number(req.query.budgetMin);
      if (req.query.budgetMax) query.rent.$lte = Number(req.query.budgetMax);
    }

    const listings = await RoomListing.find(query);

    if (listings.length === 0) {
      return res.json([]);
    }

    const scoreMap = await getOrComputeScores(req.user.id, profile, listings);

    const result = listings
      .map((listing) => {
        const s = scoreMap.get(listing._id.toString()) || { score: 0, explanation: '' };
        return { ...listing.toObject(), score: s.score, explanation: s.explanation };
      })
      .sort((a, b) => b.score - a.score);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/listings/mine — owner's own listings ───────────────────────────
// IMPORTANT: registered BEFORE /:id to prevent "mine" being parsed as id
router.get('/mine', verifyToken, requireRole('owner'), async (req, res, next) => {
  try {
    const listings = await RoomListing.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/listings/:id — single listing (all authenticated users) ─────────
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const listing = await RoomListing.findOne({
      _id: req.params.id,
      status: { $ne: 'deleted' },
    }).populate('ownerId', 'name');

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }

    let responseObj = listing.toObject();

    // If tenant with profile, attach score
    if (req.user.role === 'tenant') {
      const profile = await TenantProfile.findOne({ tenantId: req.user.id });
      if (profile) {
        const scoreMap = await getOrComputeScores(req.user.id, profile, [listing]);
        const s = scoreMap.get(listing._id.toString());
        if (s) {
          responseObj.score = s.score;
          responseObj.explanation = s.explanation;
        }
      }
    }

    res.json(responseObj);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/listings — create listing (owner) ─────────────────────────────
router.post(
  '/',
  verifyToken,
  requireRole('owner'),
  upload.array('photos', 10),
  async (req, res, next) => {
    try {
      const { location, rent, availableFrom, roomType, furnishing } = req.body;

      const missing = [];
      if (!location) missing.push('location');
      if (rent === undefined || rent === null || rent === '') missing.push('rent');
      if (!availableFrom) missing.push('availableFrom');
      if (!roomType) missing.push('roomType');
      if (!furnishing) missing.push('furnishing');
      if (missing.length) {
        return res.status(400).json({
          error: 'Missing required fields',
          details: Object.fromEntries(missing.map((f) => [f, 'required'])),
        });
      }

      const rentNum = Number(rent);
      if (isNaN(rentNum) || rentNum < 0) {
        return res.status(400).json({
          error: 'Rent must be non-negative',
          details: { rent: 'must be a non-negative number' },
        });
      }

      if (req.files && req.files.length > 10) {
        return res.status(400).json({
          error: 'Maximum 10 photos allowed',
          details: { photos: 'max 10 files' },
        });
      }

      const photos = req.files ? req.files.map((f) => f.path) : [];

      const listing = await RoomListing.create({
        ownerId: req.user.id,
        location,
        rent: rentNum,
        availableFrom,
        roomType,
        furnishing,
        photos,
      });

      res.status(201).json(listing);
    } catch (err) {
      next(err);
    }
  }
);

// ─── PUT /api/listings/:id — update listing (owner) ──────────────────────────
router.put('/:id', verifyToken, requireRole('owner'), async (req, res, next) => {
  try {
    const listing = await RoomListing.findById(req.params.id);
    if (!listing || listing.status === 'deleted') {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }
    if (listing.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your listing', details: {} });
    }

    const allowed = ['location', 'rent', 'availableFrom', 'roomType', 'furnishing'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) listing[field] = req.body[field];
    });

    await listing.save();

    // Invalidate compatibility score cache for this listing
    await CompatibilityScore.deleteMany({ listingId: listing._id });

    res.json(listing);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/listings/:id — soft delete (owner) ──────────────────────────
router.delete('/:id', verifyToken, requireRole('owner'), async (req, res, next) => {
  try {
    const listing = await RoomListing.findById(req.params.id);
    if (!listing || listing.status === 'deleted') {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }
    if (listing.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your listing', details: {} });
    }

    listing.status = 'deleted';
    await listing.save();

    res.json({ message: 'Listing deleted', id: listing._id });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/listings/:id/status — fill / re-open (owner) ─────────────────
router.patch('/:id/status', verifyToken, requireRole('owner'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['available', 'filled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be available or filled',
        details: { status: 'must be available or filled' },
      });
    }

    const listing = await RoomListing.findById(req.params.id);
    if (!listing || listing.status === 'deleted') {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }
    if (listing.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your listing', details: {} });
    }

    listing.status = status;
    await listing.save();

    res.json(listing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
