const { GoogleGenAI } = require('@google/genai');
const CompatibilityScore = require('../models/CompatibilityScore');

// ─── Fallback Rule-Based Scorer ──────────────────────────────────────────────

/**
 * fallbackScore(profile, listing) — pure function, no I/O
 * Returns { score: integer 0–100, explanation: string }
 */
function fallbackScore(profile, listing) {
  // Component 1 — Budget (0–50 points)
  let budgetScore;
  const rent = listing.rent;
  const { budgetMin, budgetMax } = profile;

  if (rent >= budgetMin && rent <= budgetMax) {
    budgetScore = 50;
  } else {
    const distance = Math.min(
      Math.abs(rent - budgetMin),
      Math.abs(rent - budgetMax)
    );
    budgetScore = Math.floor(50 * Math.max(0, 1 - distance / budgetMax));
  }

  // Component 2 — Location (0–30 points)
  const preferredWords = profile.preferredLocation.toLowerCase().split(/\s+/);
  const listingLoc = listing.location.toLowerCase();
  let locationScore;

  if (preferredWords.every((word) => listingLoc.includes(word))) {
    locationScore = 30;
  } else if (preferredWords.some((word) => listingLoc.includes(word))) {
    locationScore = 15;
  } else {
    locationScore = 0;
  }

  // Component 3 — Move-in Date (0–20 points)
  const diffMs = Math.abs(
    new Date(listing.availableFrom) - new Date(profile.moveInDate)
  );
  const diffDays = diffMs / 86_400_000;
  let dateScore;

  if (diffDays <= 7) {
    dateScore = 20;
  } else if (diffDays <= 30) {
    dateScore = 10;
  } else {
    dateScore = 0;
  }

  const score = budgetScore + locationScore + dateScore;

  return {
    score,
    explanation: 'Computed using rule-based fallback',
  };
}

// ─── LLM Scorer (Google Gemini) ───────────────────────────────────────────────

/**
 * llmScore(profile, listing) — calls Gemini; throws on timeout/error
 * Returns { score, explanation, method: 'llm' }
 */
async function llmScore(profile, listing) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const availableFromStr = new Date(listing.availableFrom)
    .toISOString()
    .split('T')[0];
  const moveInDateStr = new Date(profile.moveInDate).toISOString().split('T')[0];

  const prompt = `You are a rental compatibility assistant.

Given the following room listing and tenant profile, compute a compatibility
score from 0 to 100 and provide a brief explanation.

LISTING:
- Location: ${listing.location}
- Rent: ₹${listing.rent} per month
- Available From: ${availableFromStr}
- Room Type: ${listing.roomType}
- Furnishing: ${listing.furnishing}

TENANT PROFILE:
- Preferred Location: ${profile.preferredLocation}
- Budget Range: ₹${profile.budgetMin} – ₹${profile.budgetMax} per month
- Desired Move-in Date: ${moveInDateStr}

Respond ONLY with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "explanation": "<one or two sentence explanation>"
}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });
    clearTimeout(timer);

    const text = response.text;
    // Strip markdown code fences if present
    const clean = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (
      typeof parsed.score !== 'number' ||
      parsed.score < 0 ||
      parsed.score > 100
    ) {
      throw new Error('LLM returned invalid score');
    }

    return {
      score: Math.round(parsed.score),
      explanation: parsed.explanation,
      method: 'llm',
    };
  } catch (err) {
    clearTimeout(timer);
    console.error('[scoringService] llmScore failed:', err.message);
    throw err; // caller will invoke fallbackScore
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * getOrComputeScores(tenantId, profile, listings)
 * Returns a Map: listingId (string) → { score, explanation }
 */
async function getOrComputeScores(tenantId, profile, listings) {
  const listingIds = listings.map((l) => l._id);

  // Fetch all cached scores for this tenant + these listings
  const cached = await CompatibilityScore.find({
    tenantId,
    listingId: { $in: listingIds },
  });

  const cacheMap = new Map(
    cached.map((c) => [c.listingId.toString(), { score: c.score, explanation: c.explanation }])
  );

  // Compute missing scores
  const uncached = listings.filter((l) => !cacheMap.has(l._id.toString()));

  for (const listing of uncached) {
    let scoreData;
    let method;

    try {
      scoreData = await llmScore(profile, listing);
      method = 'llm';
    } catch {
      scoreData = fallbackScore(profile, listing);
      method = 'fallback';
    }

    // Upsert into cache
    await CompatibilityScore.findOneAndUpdate(
      { tenantId, listingId: listing._id },
      {
        tenantId,
        listingId: listing._id,
        score: scoreData.score,
        explanation: scoreData.explanation,
        method,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    cacheMap.set(listing._id.toString(), {
      score: scoreData.score,
      explanation: scoreData.explanation,
    });
  }

  return cacheMap;
}

module.exports = { fallbackScore, llmScore, getOrComputeScores };
