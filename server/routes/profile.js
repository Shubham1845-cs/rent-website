const express = require('express');
const verifyToken = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const TenantProfile = require('../models/TenantProfile');
const CompatibilityScore = require('../models/CompatibilityScore');

const router = express.Router();

// ─── PUT /api/profile — create or update profile (upsert) ────────────────────
router.put('/', verifyToken, requireRole('tenant'), async (req, res, next) => {
  try {
    const { preferredLocation, budgetMin, budgetMax, moveInDate } = req.body;

    const missing = [];
    if (!preferredLocation) missing.push('preferredLocation');
    if (budgetMin === undefined || budgetMin === null || budgetMin === '') missing.push('budgetMin');
    if (budgetMax === undefined || budgetMax === null || budgetMax === '') missing.push('budgetMax');
    if (!moveInDate) missing.push('moveInDate');
    if (missing.length) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: Object.fromEntries(missing.map((f) => [f, 'required'])),
      });
    }

    const minNum = Number(budgetMin);
    const maxNum = Number(budgetMax);

    if (minNum > maxNum) {
      return res.status(400).json({
        error: 'Minimum budget must not exceed maximum budget',
        details: { budgetMin: 'must be <= budgetMax' },
      });
    }

    const profile = await TenantProfile.findOneAndUpdate(
      { tenantId: req.user.id },
      { preferredLocation, budgetMin: minNum, budgetMax: maxNum, moveInDate },
      { upsert: true, new: true, runValidators: true }
    );

    // Invalidate all compatibility scores for this tenant (profile changed)
    await CompatibilityScore.deleteMany({ tenantId: req.user.id });

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/profile — retrieve current tenant's profile ────────────────────
router.get('/', verifyToken, requireRole('tenant'), async (req, res, next) => {
  try {
    const profile = await TenantProfile.findOne({ tenantId: req.user.id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found', details: {} });
    }
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
