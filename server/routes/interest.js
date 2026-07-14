const express = require('express');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const InterestRequest = require('../models/InterestRequest');
const RoomListing = require('../models/RoomListing');
const TenantProfile = require('../models/TenantProfile');
const User = require('../models/User');
const { getOrComputeScores } = require('../services/scoringService');
const emailService = require('../services/emailService');

const router = express.Router();

// ─── POST /api/interest — tenant expresses interest ───────────────────────────
router.post('/', verifyToken, requireRole('tenant'), async (req, res, next) => {
  try {
    const { listingId } = req.body;
    if (!listingId) {
      return res.status(400).json({ error: 'listingId is required', details: {} });
    }

    // Check listing exists and is available
    const listing = await RoomListing.findById(listingId);
    if (!listing || listing.status === 'deleted') {
      return res.status(404).json({ error: 'Listing not found', details: {} });
    }
    if (listing.status === 'filled') {
      return res.status(400).json({ error: 'Listing is no longer available', details: {} });
    }

    // Check no duplicate interest
    const duplicate = await InterestRequest.findOne({
      tenantId: req.user.id,
      listingId,
    });
    if (duplicate) {
      return res.status(409).json({ error: 'Interest already expressed', details: {} });
    }

    // Get or compute compatibility score
    const profile = await TenantProfile.findOne({ tenantId: req.user.id });
    if (!profile) {
      return res.status(400).json({
        error: 'Please complete your profile before expressing interest',
        details: {},
      });
    }

    const scoreMap = await getOrComputeScores(req.user.id, profile, [listing]);
    const scoreData = scoreMap.get(listing._id.toString()) || { score: 0 };

    // Create interest request
    const request = await InterestRequest.create({
      tenantId: req.user.id,
      listingId: listing._id,
      ownerId: listing.ownerId,
      scoreAtRequest: scoreData.score,
    });

    // Fire high-score email notification (fire-and-forget)
    if (scoreData.score > 80) {
      try {
        const owner = await User.findById(listing.ownerId);
        const tenant = await User.findById(req.user.id);
        if (owner && tenant) {
          await emailService.sendHighScoreAlert({
            ownerEmail: owner.email,
            tenantName: tenant.name,
            score: scoreData.score,
            listingLocation: listing.location,
            interestId: request._id,
          });
        }
      } catch (emailErr) {
        console.error('[email] sendHighScoreAlert failed:', emailErr.message);
      }
    }

    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/interest — list requests (tenant sees own; owner sees theirs) ───
router.get('/', verifyToken, async (req, res, next) => {
  try {
    let requests;

    if (req.user.role === 'tenant') {
      requests = await InterestRequest.find({ tenantId: req.user.id })
        .populate('listingId', 'location rent')
        .populate('ownerId', 'name email')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'owner') {
      requests = await InterestRequest.find({ ownerId: req.user.id })
        .populate('listingId', 'location rent')
        .populate('tenantId', 'name email')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ error: 'Forbidden', details: {} });
    }

    res.json(requests);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/interest/:id — owner accepts or declines ─────────────────────
router.patch('/:id', verifyToken, requireRole('owner'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({
        error: 'Status must be accepted or declined',
        details: { status: 'must be accepted or declined' },
      });
    }

    const request = await InterestRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Interest request not found', details: {} });
    }
    if (request.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: not your listing', details: {} });
    }

    request.status = status;
    await request.save();

    // Send email notification to tenant (fire-and-forget)
    try {
      const tenant = await User.findById(request.tenantId);
      const owner = await User.findById(request.ownerId);
      const listing = await RoomListing.findById(request.listingId);

      if (tenant && owner && listing) {
        if (status === 'accepted') {
          await emailService.sendInterestAccepted({
            tenantEmail: tenant.email,
            ownerName: owner.name,
            listingLocation: listing.location,
            requestId: request._id,
          });
        } else {
          await emailService.sendInterestDeclined({
            tenantEmail: tenant.email,
            ownerName: owner.name,
            listingLocation: listing.location,
          });
        }
      } else {
        console.warn('[email] Missing tenant, owner, or listing data. Skipping email.');
      }
    } catch (emailErr) {
      console.error('[email] interest response email failed:', emailErr.message);
    }

    res.json(request);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
