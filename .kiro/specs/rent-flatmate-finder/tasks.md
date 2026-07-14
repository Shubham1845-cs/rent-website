# Implementation Plan: Rent & Flatmate Finder

## Overview

Full-stack MERN implementation built in eight sequenced groups. Each group is independently
demonstrable. Backend is a single Express monolith with Socket.io on the same HTTP server.
Frontend is a Vite/React SPA styled with Tailwind CSS. Plain JavaScript throughout (no TypeScript).

---

## Tasks

### Group 1 — Foundation & Auth

- [-] 1. Project scaffold
  - Create `server/` and `client/` directory skeletons with all sub-folders listed in the design
  - Create `server/package.json` with dependencies: express, mongoose, bcryptjs, jsonwebtoken, dotenv, cors, multer, cloudinary, multer-storage-cloudinary, socket.io, nodemailer/resend, @google/generative-ai, fast-check, jest, supertest, mongodb-memory-server
  - Create `client/package.json` with dependencies: react, react-dom, react-router-dom, axios, socket.io-client, vite, tailwindcss, vitest, @testing-library/react
  - Create `.env.example` at repo root listing: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CLIENT_URL`, `EMAIL_HOST`/`RESEND_API_KEY`
  - Create `server/app.js` as an Express app factory (mounts routers, global error handler, no `listen`); wire `app.use(cors({ origin: process.env.CLIENT_URL }))` as the first middleware so all REST routes and the eventual Socket.io upgrade are covered from the start
  - Create `server/index.js` that calls `http.createServer(app)`, connects MongoDB, seeds admin, then starts listening
  - Create `server/config/db.js` for the Mongoose connection
  - **Files:** `server/package.json`, `client/package.json`, `.env.example`, `server/app.js`, `server/index.js`, `server/config/db.js`
  - **Done when:** `node server/index.js` starts without errors; `GET /` or any unknown route returns a JSON 404; MongoDB connection log line prints; a cross-origin request from `:5173` receives CORS headers.

- [ ] 2. MongoDB connection + admin seed
  - Implement `server/config/db.js` to call `mongoose.connect(process.env.MONGODB_URI)` and log success/failure
  - Implement `server/utils/adminSeed.js`: if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are absent, log warning and return; if an admin already exists, skip; otherwise hash password with bcrypt (≥ 10 rounds) and create User `{ name:'Admin', email, passwordHash, role:'admin' }`
  - Call `adminSeed()` inside `server/index.js` after the DB connects
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - **Files:** `server/config/db.js`, `server/utils/adminSeed.js`, `server/index.js`
  - **Done when:** First run creates admin document in MongoDB; second run logs "Admin already exists" and creates no duplicate; missing env vars log warning with no crash.

- [ ] 3. User model
  - Implement `server/models/User.js` Mongoose schema with fields: `name`, `email` (unique, lowercase), `passwordHash`, `role` (enum: tenant/owner/admin), `isDeleted` (default false), `createdAt`
  - _Requirements: 1.1, 1.5, 15.2_
  - **Files:** `server/models/User.js`
  - **Done when:** `new User({...}).save()` succeeds with valid data; saving duplicate email throws a MongoDB unique-index error.

- [ ] 4. Auth routes (register + login)
  - Implement `server/routes/auth.js` with `POST /register` (validate name/email/password/role, bcrypt hash, save User, sign JWT `{ userId, role }` exp 24 h, return `{ token, user }`) and `POST /login` (find by email, check `isDeleted`, `bcrypt.compare`, sign JWT, return `{ token, user }`)
  - Mount router in `server/app.js` at `/api/auth`
  - Return 409 for duplicate email; 401 for bad credentials; 400 for missing fields
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 21.1, 21.4_
  - **Files:** `server/routes/auth.js`, `server/app.js`
  - **Done when:** `POST /api/auth/register` with valid body returns 201 + token; duplicate email returns 409 `{ error:"Email already registered" }`; `POST /api/auth/login` with valid creds returns 200 + token; wrong password returns 401.

  - [ ] 4.1. Property tests for auth
    - Write fast-check property tests for Property 1 (password hashing), Property 2 (JWT claims), Property 3 (duplicate registration)
    - _Requirements: 1.2, 1.3, 1.5, 1.6_
    - **Files:** `server/tests/auth.property.test.js`
    - **Done when:** `jest server/tests/auth.property.test.js` runs 100 iterations each and all pass.

- [ ] 5. JWT middleware + role guard
  - Implement `server/middleware/auth.js`: extract Bearer token from `Authorization` header, `jwt.verify`, attach `req.user = { id, role }`; return 401 if missing/expired/invalid
  - Implement `server/middleware/roleGuard.js`: export `requireRole(...roles)` factory that returns middleware checking `req.user.role` against allowed roles; returns 403 if no match
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - **Files:** `server/middleware/auth.js`, `server/middleware/roleGuard.js`
  - **Done when:** Request with no token to a protected route returns 401; valid tenant token on an owner-only route returns 403; valid admin token on any route returns 200.

  - [ ] 5.1. Property test for RBAC invariant
    - Write fast-check property test for Property 4 (RBAC invariant) using a minimal protected test route
    - **Property 4: Role-based access control invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - **Files:** `server/tests/rbac.property.test.js`
    - **Done when:** `jest server/tests/rbac.property.test.js` runs 100 iterations and all pass.

- [ ] 6. Group 1 Checkpoint
  - Ensure all Group 1 tests pass, ask the user if questions arise.

---

### Group 2 — Listings CRUD (Owner)

- [ ] 7. RoomListing model
  - Implement `server/models/RoomListing.js` Mongoose schema: `ownerId` (ObjectId ref User), `location` (max 200), `rent` (min 0), `availableFrom` (Date), `roomType` (enum), `furnishing` (enum), `photos` (array of strings, max 10 enforced in route), `status` (enum available/filled/deleted, default available), `createdAt`
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - **Files:** `server/models/RoomListing.js`
  - **Done when:** Model saves with valid data; Mongoose rejects unknown enum values.

- [ ] 8. Photo upload middleware (Multer + Cloudinary)
  - Create `server/middleware/upload.js`: configure `multer-storage-cloudinary` with Cloudinary credentials from env; accept JPEG/PNG/WebP only; max 5MB per file; export `upload.array('photos', 10)`
  - _Requirements: 4.3, 4.4, 4.8_
  - **Files:** `server/middleware/upload.js`
  - **Done when:** Uploading 1 valid image returns a Cloudinary URL in `req.files[0].path`; uploading an unsupported format returns a Multer error.

- [ ] 9. POST /api/listings — create listing
  - Implement `POST /api/listings` in `server/routes/listings.js`; guard with `auth` + `requireRole('owner')`; use `upload` middleware; validate required fields + rent ≥ 0 + ≤ 10 photos; collect Cloudinary URLs from `req.files`; save RoomListing; return 201 + document
  - Mount listings router in `server/app.js` at `/api/listings`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 21.1, 21.2_
  - **Files:** `server/routes/listings.js`, `server/app.js`
  - **Done when:** Owner POST with valid multipart body returns 201 with Cloudinary URLs; 11 photos return 400 `{ error:"Maximum 10 photos allowed" }`; negative rent returns 400.

- [ ] 10. GET /api/listings/:id — single listing with score
  - Add `GET /api/listings/:id` to `server/routes/listings.js`; guard with `auth`; find listing by `_id` where `status != 'deleted'`; return 404 if not found; populate `ownerId` (name only)
  - If `req.user.role === 'tenant'`: look up TenantProfile for `req.user.id`; if profile exists call `getOrComputeScores(tenantId, profile, [listing])` (same function from task 22) and merge `score` + `explanation` into the response object; if no profile, return listing without score
  - _Requirements: 4.1, 3.4, 6.5_
  - **Files:** `server/routes/listings.js`
  - **Done when:** Tenant with profile gets listing + score + explanation; tenant without profile gets listing without score field; deleted listing returns 404; unauthenticated request returns 401.

- [ ] 11. PUT /api/listings/:id — owner update
  - Add `PUT /api/listings/:id` to `server/routes/listings.js`; guard with `auth` + `requireRole('owner')`; verify `listing.ownerId == req.user.id` else 403; update allowed fields; return updated document
  - On update, delete all `CompatibilityScore` docs for `listingId` (cache invalidation)
  - _Requirements: 4.5, 4.7_
  - **Files:** `server/routes/listings.js`
  - **Done when:** Owner updates own listing returns 200; different owner returns 403; score cache is cleared.

- [ ] 12. DELETE /api/listings/:id — soft delete
  - Add `DELETE /api/listings/:id`; guard owner; verify ownership; set `status = 'deleted'`; return 200
  - _Requirements: 4.6, 4.7_
  - **Files:** `server/routes/listings.js`
  - **Done when:** Owner delete returns 200; subsequent GET returns 404; other owner returns 403.

- [ ] 13. PATCH /api/listings/:id/status — fill / re-open
  - Add `PATCH /api/listings/:id/status`; guard owner; verify ownership; accept `{ status: 'available'|'filled' }`; update and return document
  - _Requirements: 4.S1, 4.S2, 4.S3 (Req 4 status management)_
  - **Files:** `server/routes/listings.js`
  - **Done when:** PATCH `{ status:'filled' }` returns 200 with `status:'filled'`; PATCH `{ status:'available' }` restores listing; invalid status value returns 400.

  - [ ] 13.1. Property test — listing ownership enforcement
    - Write fast-check property test for Property 5 (listing ownership enforcement) — any owner B cannot mutate owner A's listing
    - **Property 5: Listing ownership enforcement**
    - **Validates: Requirements 4.7**
    - **Files:** `server/tests/listings.property.test.js`
    - **Done when:** `jest server/tests/listings.property.test.js` runs 100 iterations and all pass.

- [ ] 13.2. GET /api/listings/mine — owner's own listings
  - Add `GET /api/listings/mine` to `server/routes/listings.js`; guard with `auth` + `requireRole('owner')`; query all RoomListing docs where `ownerId === req.user.id` (all statuses — available, filled, deleted); return array sorted by `createdAt` descending; no scoring attached (owners don't need compatibility scores on their own listings)
  - Note: register this route BEFORE `GET /api/listings/:id` in the router so Express does not misinterpret "mine" as an `:id` param
  - _Requirements: 4.1, 4.5, 4.6_
  - **Files:** `server/routes/listings.js`
  - **Done when:** Owner gets all their own listings including filled/deleted; tenant hitting this route gets 403; empty owner account returns empty array 200.

- [ ] 14. Group 2 Checkpoint
  - Ensure all Group 2 tests pass, ask the user if questions arise.

---

### Group 3 — Tenant Profile

- [ ] 15. TenantProfile model
  - Implement `server/models/TenantProfile.js` Mongoose schema: `tenantId` (ObjectId ref User, unique), `preferredLocation` (max 200), `budgetMin` (min 0), `budgetMax` (min 0), `moveInDate` (Date), `createdAt`
  - _Requirements: 5.1, 5.4_
  - **Files:** `server/models/TenantProfile.js`
  - **Done when:** Model saves with valid data; duplicate `tenantId` throws unique-index error.

- [ ] 16. PUT /api/profile — upsert profile
  - Implement `server/routes/profile.js` with `PUT /api/profile`; guard with `auth` + `requireRole('tenant')`; validate `budgetMin <= budgetMax`; upsert using `{ tenantId: req.user.id }` as filter; on update, delete all `CompatibilityScore` docs for that tenant (cache invalidation); return 200 + profile
  - Mount profile router in `server/app.js` at `/api/profile`
  - _Requirements: 5.1, 5.2_
  - **Files:** `server/routes/profile.js`, `server/app.js`
  - **Done when:** First PUT creates profile (201); second PUT with same tenantId updates (200); `budgetMin > budgetMax` returns 400 `{ error:"Minimum budget must not exceed maximum budget" }`; score cache is cleared on update.

- [ ] 17. GET /api/profile — retrieve profile
  - Add `GET /api/profile` to `server/routes/profile.js`; guard tenant; return current profile or 404 if none
  - _Requirements: 5.3_
  - **Files:** `server/routes/profile.js`
  - **Done when:** Tenant with profile gets 200 + document; tenant without profile gets 404.

- [ ] 18. Group 3 Checkpoint
  - Ensure all Group 3 tests pass, ask the user if questions arise.

---

### Group 4 — Compatibility Scoring

- [ ] 19. CompatibilityScore model
  - Implement `server/models/CompatibilityScore.js`: `tenantId`, `listingId`, `score` (0–100), `explanation`, `method` (enum: llm/fallback), `createdAt`; compound unique index `{ tenantId:1, listingId:1 }`
  - _Requirements: 7.4, 8.4_
  - **Files:** `server/models/CompatibilityScore.js`
  - **Done when:** Model saves; duplicate (tenantId, listingId) throws unique-index error.

- [ ] 20. scoringService.js — fallbackScore()
  - Implement `server/services/scoringService.js` exporting `fallbackScore(profile, listing)` as a pure function (no I/O, no DB calls)
  - Budget component (0–50), location component (0–30), date component (0–20) exactly as specified in the design
  - Return `{ score: integer, explanation: "Computed using rule-based fallback" }`
  - _Requirements: 8.3, 8.4_
  - **Files:** `server/services/scoringService.js`
  - **Done when:** Unit test: rent within budget → budgetScore=50; exact word match → locationScore=30; 0 days diff → dateScore=20; total=100.

  - [ ] 20.1. Property test — fallback formula correctness
    - Write fast-check property test for Property 9 (rule-based fallback formula) — score always integer in [0, 100]
    - **Property 9: Rule-based fallback formula correctness**
    - **Validates: Requirements 8.3**
    - **Files:** `server/tests/scoring.property.test.js`
    - **Done when:** `jest server/tests/scoring.property.test.js` runs 100 iterations and all pass.

- [ ] 21. scoringService.js — llmScore()
  - Add `llmScore(profile, listing)` to `server/services/scoringService.js`
  - Build the prompt template from the design; call `@google/generative-ai` `gemini-1.5-flash`; wrap with `AbortController` / 10 s `setTimeout`; parse `JSON.parse(response.text())`; validate `score` is integer 0–100; return `{ score, explanation, method:'llm' }`; on timeout/parse error throw so caller can fallback
  - _Requirements: 7.2, 7.3, 7.6, 7.7, 8.1, 8.2, 8.5_
  - **Files:** `server/services/scoringService.js`
  - **Done when:** With mocked Gemini returning valid JSON, function returns parsed score; with mocked timeout or invalid JSON, function throws (triggering fallback in caller).

- [ ] 22. scoringService.js — getOrComputeScores()
  - Add `getOrComputeScores(tenantId, profile, listings)` to `server/services/scoringService.js`
  - Fetch all existing `CompatibilityScore` docs for `(tenantId, listingIds[])`; for uncached pairs try `llmScore`, catch errors/timeouts → `fallbackScore`; upsert new `CompatibilityScore` docs; return merged map `{ listingId → { score, explanation } }`
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 8.1, 8.2, 8.4_
  - **Files:** `server/services/scoringService.js`
  - **Done when:** First call with no cache saves new CompatibilityScore docs and returns scores; second call for same pair reads cache without calling LLM.

  - [ ] 22.1. Property test — score caching (LLM called at most once per pair)
    - Write fast-check property test for Property 8 (score caching) — `getOrComputeScores` called twice for same pair; mock LLM call count; assert count=1
    - **Property 8: Score caching — LLM called at most once per pair**
    - **Validates: Requirements 7.2, 7.5**
    - **Files:** `server/tests/scoring.property.test.js`
    - **Done when:** Property test passes 100 iterations with zero extra LLM calls on cache hit.

- [ ] 23. GET /api/listings — browse with scoring + filters
  - Add `GET /api/listings` to `server/routes/listings.js`; guard `auth` + `requireRole('tenant')`; look up `TenantProfile` for `req.user.id` — return 400 `{ error:"Please complete your profile before browsing listings" }` if none; query non-deleted, non-filled listings with optional `location` (case-insensitive contains) and `budgetMin`/`budgetMax` filters; call `getOrComputeScores`; merge scores into listing objects; sort descending by score; return array
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1_
  - **Files:** `server/routes/listings.js`
  - **Done when:** Tenant with profile gets sorted listings each containing `score` and `explanation`; tenant without profile gets 400; location filter excludes non-matching listings; budget filter excludes out-of-range listings.

  - [ ] 23.1. Property test — filter correctness
    - Write fast-check property test for Property 6 (listing filter correctness) — every returned listing satisfies all applied filters simultaneously
    - **Property 6: Listing filter correctness**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - **Files:** `server/tests/listings.property.test.js`
    - **Done when:** 100 iterations, every result listing satisfies all filter constraints.

  - [ ] 23.2. Property test — browse results include score and explanation
    - Write fast-check property test for Property 7 — every listing object in the browse response has a non-null integer score (0–100) and non-empty explanation string
    - **Property 7: Browse results include score and explanation**
    - **Validates: Requirements 6.5, 7.4, 7.7**
    - **Files:** `server/tests/listings.property.test.js`
    - **Done when:** 100 iterations, all response listings carry valid score + explanation.

- [ ] 24. Group 4 Checkpoint
  - Ensure all Group 4 tests pass, ask the user if questions arise.

---

### Group 5 — Interest Requests + Email Notifications

- [ ] 25. InterestRequest model
  - Implement `server/models/InterestRequest.js`: `tenantId`, `listingId`, `ownerId`, `status` (enum: pending/accepted/declined, default pending), `scoreAtRequest` (required), `createdAt`; compound unique index `{ tenantId:1, listingId:1 }`
  - _Requirements: 9.1, 9.4_
  - **Files:** `server/models/InterestRequest.js`
  - **Done when:** Model saves; duplicate (tenantId, listingId) throws unique-index error.

- [ ] 26. emailService.js
  - Implement `server/services/emailService.js` with three functions:
    - `sendHighScoreAlert({ ownerEmail, tenantName, score, listingLocation, interestId })` — subject "New high-compatibility interest in your listing"
    - `sendInterestAccepted({ tenantEmail, ownerName, listingLocation, requestId })` — subject "Your interest was accepted"
    - `sendInterestDeclined({ tenantEmail, ownerName, listingLocation })` — subject "Your interest was declined"
  - Use Resend or Nodemailer depending on env config; all calls are fire-and-forget (caller wraps in try/catch)
  - _Requirements: 13.1, 13.2, 13.4, 14.1, 14.2, 14.3_
  - **Files:** `server/services/emailService.js`
  - **Done when:** With mocked transport, each function calls the transport exactly once with correct `to`, `subject`, and body fields; missing env vars throw a clear configuration error at startup.

- [ ] 27. POST /api/interest — express interest
  - Implement `server/routes/interest.js` with `POST /api/interest`; guard `auth` + `requireRole('tenant')`; validate `listingId` present; check listing exists and is not filled/deleted (else 400); check no existing InterestRequest for this pair (else 409 `{ error:"Interest already expressed" }`); compute or fetch CompatibilityScore; create InterestRequest with `scoreAtRequest`; if `scoreAtRequest > 80` fire `sendHighScoreAlert` (try/catch, log failure); return 201 + request
  - Mount interest router in `server/app.js` at `/api/interest`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 13.1, 13.3_
  - **Files:** `server/routes/interest.js`, `server/app.js`
  - **Done when:** Valid request returns 201; duplicate returns 409; filled listing returns 400; scoreAtRequest > 80 triggers sendHighScoreAlert; ≤ 80 does not.

  - [ ] 27.1. Property test — no duplicate interest requests
    - Write fast-check property test for Property 10 (no duplicate interest requests)
    - **Property 10: No duplicate interest requests**
    - **Validates: Requirements 9.2**
    - **Files:** `server/tests/interest.property.test.js`
    - **Done when:** 100 iterations, second POST for same pair always returns 409 with correct message.

  - [ ] 27.2. Property test — interest captures score at request time
    - Write fast-check property test for Property 11 (scoreAtRequest equals CompatibilityScore at creation time)
    - **Property 11: Interest captures score at request time**
    - **Validates: Requirements 9.4**
    - **Files:** `server/tests/interest.property.test.js`
    - **Done when:** 100 iterations, `scoreAtRequest` always equals the score fetched from CompatibilityScore at moment of request creation.

- [ ] 28. GET /api/interest — list requests
  - Add `GET /api/interest` to `server/routes/interest.js`; guard `auth`; if tenant: return own requests populated with listing location + owner name; if owner: return requests on their listings populated with tenant name + score; other roles 403
  - _Requirements: 10.1, 10.2_
  - **Files:** `server/routes/interest.js`
  - **Done when:** Tenant sees only their own requests; owner sees only requests on their listings; tenant with no requests gets empty array 200.

- [ ] 29. PATCH /api/interest/:id — accept / decline
  - Add `PATCH /api/interest/:id`; guard `auth` + `requireRole('owner')`; load request; verify `request.ownerId == req.user.id` else 403; accept/decline body `{ status }`; update; fire `sendInterestAccepted` or `sendInterestDeclined` (try/catch, log failure); return updated request
  - _Requirements: 10.1, 10.2, 10.3, 14.1, 14.2, 14.3, 14.4_
  - **Files:** `server/routes/interest.js`
  - **Done when:** Owner sets status to accepted/declined and gets 200; wrong owner gets 403; email service is called for each status change.

  - [ ] 29.1. Property test — interest status transitions are owner-gated
    - Write fast-check property test for Property 12 (PATCH by non-owner always returns 403)
    - **Property 12: Interest status transitions are owner-gated**
    - **Validates: Requirements 10.3**
    - **Files:** `server/tests/interest.property.test.js`
    - **Done when:** 100 iterations, any user who is not the listing owner always gets 403.

  - [ ] 29.2. Property test — email triggered on high-score interest
    - Write fast-check property test for Property 14 (email called exactly once when score > 80, not called when ≤ 80)
    - **Property 14: Email triggered on high-score interest**
    - **Validates: Requirements 13.1**
    - **Files:** `server/tests/interest.property.test.js`
    - **Done when:** 100 iterations, email call count is exactly 1 for score > 80 and 0 for score ≤ 80.

  - [ ] 29.3. Property test — email triggered on interest status change
    - Write fast-check property test for Property 15 (accepted → email with correct subject; declined → email with correct subject)
    - **Property 15: Email triggered on interest status change**
    - **Validates: Requirements 14.1, 14.2**
    - **Files:** `server/tests/interest.property.test.js`
    - **Done when:** 100 iterations, correct subject used for each status transition.

- [ ] 30. Group 5 Checkpoint
  - Ensure all Group 5 tests pass, ask the user if questions arise.

---

### Group 6 — Real-Time Chat

- [ ] 31. ChatMessage model
  - Implement `server/models/ChatMessage.js`: `chatSessionId` (String, required), `senderId` (ObjectId ref User), `receiverId` (ObjectId ref User), `text` (max 2000), `createdAt`; index `{ chatSessionId:1, createdAt:1 }`
  - Export helper `buildChatSessionId(tenantId, ownerId)` → sorts both IDs and joins with `_`
  - _Requirements: 12.1, 12.3_
  - **Files:** `server/models/ChatMessage.js`
  - **Done when:** `buildChatSessionId('bbb','aaa')` === `buildChatSessionId('aaa','bbb')`; message with text > 2000 chars is rejected by Mongoose maxlength.

- [ ] 32. GET /api/chat/:requestId/messages — REST history
  - Implement `server/routes/chat.js` with `GET /api/chat/:requestId/messages`; guard `auth`; load InterestRequest by `requestId`; verify `req.user.id` equals `request.tenantId` or `request.ownerId` else 403; compute `chatSessionId` via `buildChatSessionId`; query ChatMessage by `chatSessionId` sorted `createdAt` asc; return array
  - Mount chat router in `server/app.js` at `/api/chat`
  - _Requirements: 12.2, 11.5_
  - **Files:** `server/routes/chat.js`, `server/app.js`
  - **Done when:** Tenant or owner of the request gets 200 + chronological messages; unrelated user gets 403; invalid requestId gets 404.

- [ ] 33. socket.js — Socket.io setup + JWT auth middleware
  - Implement `server/socket.js` exporting `initSocket(httpServer)`
  - Create `new Server(httpServer, { cors: { origin: process.env.CLIENT_URL } })`
  - Add `io.use(...)` middleware: extract `socket.handshake.auth.token`; `jwt.verify`; attach `socket.user`; call `next()` or `next(new Error('Unauthorized'))`
  - Call `initSocket(httpServer)` in `server/index.js` after DB connects
  - _Requirements: 11.1, 11.4, 1.8_
  - **Files:** `server/socket.js`, `server/index.js`
  - **Done when:** Client connecting with valid JWT attaches without error; client with no/invalid JWT is disconnected with `error: "Unauthorized"`.

- [ ] 34. socket.js — join_chat event
  - Add `join_chat` handler inside `initSocket`: receive `{ requestId }`; load InterestRequest; verify socket.user.id is tenant or owner; if not emit `error` event and return; compute room name via `buildChatSessionId`; `socket.join(roomName)`
  - _Requirements: 11.2, 11.5_
  - **Files:** `server/socket.js`
  - **Done when:** Valid participant joins the room; non-participant receives `error` event and is not added to room.

- [ ] 35. socket.js — send_message event + persistence
  - Add `send_message` handler: receive `{ requestId, text }`; validate `text.length <= 2000` else emit error; load InterestRequest; compute chatSessionId; determine senderId/receiverId; persist new `ChatMessage`; `io.to(roomName).emit('receive_message', { chatSessionId, senderId, text, createdAt })`
  - _Requirements: 11.2, 11.3, 12.1, 12.3, 12.4_
  - **Files:** `server/socket.js`
  - **Done when:** Sender emits `send_message`; both sockets in room receive `receive_message`; ChatMessage is persisted in MongoDB; text > 2000 chars emits `error` event and nothing is saved.

  - [ ] 35.1. Property test — chat message persistence round-trip
    - Write fast-check property test for Property 13 (any sequence of sent messages is returned in chronological order by GET history)
    - **Property 13: Chat message persistence round-trip**
    - **Validates: Requirements 12.1, 12.2**
    - **Files:** `server/tests/chat.property.test.js`
    - **Done when:** 100 iterations, message order from REST endpoint matches insertion order by createdAt.

- [ ] 36. Group 6 Checkpoint
  - Ensure all Group 6 tests pass, ask the user if questions arise.

---

### Group 7 — Admin Panel (Backend)

- [ ] 37. Admin user management routes
  - Implement `server/routes/admin.js` with `GET /api/admin/users` (all users, exclude `passwordHash`) and `PATCH /api/admin/users/:id` (`{ isDeleted: true|false }` — soft delete or reactivate)
  - Guard both with `auth` + `requireRole('admin')`
  - Mount admin router in `server/app.js` at `/api/admin`
  - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - **Files:** `server/routes/admin.js`, `server/app.js`
  - **Done when:** Admin GET returns all users without passwordHash; PATCH sets `isDeleted`; deleted user's subsequent login returns 401 (`isDeleted` check in `POST /api/auth/login`); reactivated user can log in again.

  - [ ] 37.1. Property test — soft-delete prevents login; reactivation restores it
    - Write fast-check property test for Property 16 (isDeleted: true blocks login; isDeleted: false allows it)
    - **Property 16: Soft-delete prevents login; reactivation restores access**
    - **Validates: Requirements 15.2, 15.4**
    - **Files:** `server/tests/admin.property.test.js`
    - **Done when:** 100 iterations, soft-deleted users always fail login; reactivated users always succeed.

- [ ] 38. Admin listing management routes
  - Add `GET /api/admin/listings` (all listings including filled/deleted) and `DELETE /api/admin/listings/:id` (soft-delete, status → 'deleted') to `server/routes/admin.js`; guard admin
  - _Requirements: 16.1, 16.2_
  - **Files:** `server/routes/admin.js`
  - **Done when:** Admin GET returns all listings regardless of status; admin DELETE sets status to deleted; non-admin gets 403.

- [ ] 39. Admin metrics route
  - Add `GET /api/admin/metrics` to `server/routes/admin.js`; compute directly from DB (no caching): `usersByRole` (count per role), `activeListings` (status=available count), `interestByStatus` (count per status), `messagesLast30Days` (count where createdAt ≥ now-30d)
  - _Requirements: 17.1, 17.2_
  - **Files:** `server/routes/admin.js`
  - **Done when:** GET returns JSON with all four keys populated with correct aggregate values.

- [ ] 40. Group 7 Checkpoint
  - Ensure all Group 7 tests pass, ask the user if questions arise.

---

### Group 8 — Frontend

- [ ] 41. Vite + React + Tailwind scaffold
  - Initialise Vite React project in `client/`; install and configure Tailwind CSS (tailwind.config.js, postcss.config.js, import in `client/src/index.css`)
  - Create `client/src/main.jsx` (mounts `<App />`) and `client/src/App.jsx` (empty shell with `<BrowserRouter>`)
  - _Requirements: 18.5_
  - **Files:** `client/index.html`, `client/vite.config.js`, `client/tailwind.config.js`, `client/postcss.config.js`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/index.css`
  - **Done when:** `npm run dev` in `client/` serves the app at `:5173`; Tailwind utility classes render correctly; no console errors.

- [ ] 42. AuthContext + useReducer
  - Implement `client/src/context/AuthContext.jsx`: `initialState = { user:null, token:null }`; `authReducer` handling `LOGIN`/`LOGOUT`; on mount read from `localStorage`; on LOGIN store to `localStorage`; on LOGOUT clear; export `AuthContext` and `AuthProvider`
  - Wrap `<App>` with `<AuthProvider>` in `client/src/main.jsx`
  - _Requirements: 1.7, 18.4_
  - **Files:** `client/src/context/AuthContext.jsx`, `client/src/main.jsx`
  - **Done when:** Login dispatches `LOGIN` and token appears in `localStorage`; page refresh re-hydrates state; logout clears state and localStorage.

- [ ] 43. ChatContext + useReducer
  - Implement `client/src/context/ChatContext.jsx`: `initialState = { messages:[] }`; `chatReducer` handling `SET_MESSAGES`/`APPEND_MESSAGE`; export `ChatContext` and `ChatProvider`
  - Wrap app with `<ChatProvider>` inside `<AuthProvider>` in `client/src/main.jsx`
  - _Requirements: 18.4_
  - **Files:** `client/src/context/ChatContext.jsx`, `client/src/main.jsx`
  - **Done when:** `SET_MESSAGES([...])` replaces messages array; `APPEND_MESSAGE(msg)` appends one message; context is accessible from any child component.

- [ ] 44. Axios client with Bearer token interceptor
  - Create `client/src/api/client.js`: `axios.create({ baseURL: import.meta.env.VITE_API_URL })`; add request interceptor that reads token from `AuthContext` (or directly from `localStorage`) and sets `Authorization: Bearer <token>`
  - _Requirements: 1.7_
  - **Files:** `client/src/api/client.js`
  - **Done when:** Any call via this client automatically includes the token header if stored; unauthenticated calls omit the header.

- [ ] 45. ProtectedRoute component
  - Implement `client/src/components/ProtectedRoute.jsx`: reads `AuthContext`; if token absent redirect to `/login`; if required role(s) specified and role doesn't match redirect to `/login`; otherwise render `<Outlet />`
  - _Requirements: 3.1, 3.2, 3.3_
  - **Files:** `client/src/components/ProtectedRoute.jsx`
  - **Done when:** Unauthenticated user visiting `/listings` is redirected to `/login`; owner visiting `/dashboard/tenant` is redirected to `/login`.

- [ ] 46. Navbar component
  - Implement `client/src/components/Navbar.jsx`: `flex justify-between items-center px-6 py-3`; show brand name left; right side shows links based on auth state (Login/Register when logged out; role-appropriate dashboard link + Logout when logged in); Logout dispatches `LOGOUT` to AuthContext
  - _Requirements: 18.3_
  - **Files:** `client/src/components/Navbar.jsx`, `client/src/App.jsx`
  - **Done when:** Navbar renders in all pages; logout clears state; links match user role.

- [ ] 47. LoginPage + RegisterPage
  - Implement `client/src/pages/LoginPage.jsx`: form with email + password; POST `/api/auth/login`; on success dispatch `LOGIN` and navigate to role dashboard; show error on failure
  - Implement `client/src/pages/RegisterPage.jsx`: form with name, email, password, role selector; POST `/api/auth/register`; on success dispatch `LOGIN` and navigate; show error on failure
  - Add routes `/login` and `/register` to `client/src/App.jsx`
  - _Requirements: 1.1, 1.3, 1.4_
  - **Files:** `client/src/pages/LoginPage.jsx`, `client/src/pages/RegisterPage.jsx`, `client/src/App.jsx`
  - **Done when:** Successful login/register stores token and redirects to dashboard; duplicate email shows "Email already registered" error; wrong password shows "Invalid credentials".

- [ ] 48. TenantDashboardPage (profile form)
  - Implement `client/src/pages/TenantDashboardPage.jsx`: on mount GET `/api/profile` to pre-fill form; form fields: preferredLocation, budgetMin, budgetMax, moveInDate; submit PUT `/api/profile`; show success/error messages; layout `flex flex-col gap-4`
  - Add route `/dashboard/tenant` in `App.jsx` wrapped in `<ProtectedRoute roles={['tenant']} />`
  - _Requirements: 5.1, 5.2, 5.3_
  - **Files:** `client/src/pages/TenantDashboardPage.jsx`, `client/src/App.jsx`
  - **Done when:** Existing profile pre-fills form; valid submit shows success; `budgetMin > budgetMax` shows server error message.

- [ ] 49. OwnerDashboardPage (listing form + listings list)
  - Implement `client/src/pages/OwnerDashboardPage.jsx`: listing creation form (`multipart/form-data`: location, rent, availableFrom, roomType, furnishing, photo file inputs); POST `/api/listings`; below form, list owner's own listings fetched via `GET /api/listings/mine`; each row has Edit, Delete, and Mark Filled/Available buttons wired to corresponding endpoints; layout `flex flex-col gap-4`
  - Add route `/dashboard/owner` wrapped in `<ProtectedRoute roles={['owner']} />`
  - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.S1, 4.S3_
  - **Files:** `client/src/pages/OwnerDashboardPage.jsx`, `client/src/App.jsx`
  - **Done when:** Creating a listing shows it in the list below; deleting removes it from list; Mark Filled hides it from tenant browse; Mark Available restores it.

- [ ] 50. FilterBar + ListingCard components
  - Implement `client/src/components/FilterBar.jsx`: controlled inputs for location, budgetMin, budgetMax; `flex flex-wrap gap-2`; on change calls `onFilter` callback prop
  - Implement `client/src/components/ListingCard.jsx`: `flex flex-col rounded shadow p-4`; displays photo (first URL or placeholder), location, rent, roomType, furnishing; shows `ScoreBadge` (inline badge with score number and colour coding green/yellow/red) if `score` prop present
  - _Requirements: 6.2, 6.3, 6.5_
  - **Files:** `client/src/components/FilterBar.jsx`, `client/src/components/ListingCard.jsx`
  - **Done when:** FilterBar fires `onFilter` with current values on every input change; ListingCard renders all fields; ScoreBadge shows score in correct colour tier.

- [ ] 51. ListingsPage (browse + redirect on 400)
  - Implement `client/src/pages/ListingsPage.jsx`: on mount (and on filter change) GET `/api/listings` with query params from FilterBar; if server returns 400 `"Please complete your profile…"` navigate to `/dashboard/tenant`; render grid `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` of `<ListingCard>`s; clicking a card navigates to `/listings/:id`; layout `flex flex-col gap-4`
  - Add route `/listings` in `App.jsx` wrapped in `<ProtectedRoute roles={['tenant']} />`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - **Files:** `client/src/pages/ListingsPage.jsx`, `client/src/App.jsx`
  - **Done when:** Listings render sorted by score; filter inputs narrow results; no-profile tenant is redirected to `/dashboard/tenant`.

- [ ] 52. ListingDetailPage (detail view + InterestButton)
  - Implement `client/src/pages/ListingDetailPage.jsx`: GET `/api/listings/:id`; layout `flex flex-col md:flex-row gap-6` (photos left, details right); show location, rent, roomType, furnishing, availableFrom, score badge, explanation; `InterestButton` — POST `/api/interest` with `listingId`; show "Interest sent" on success, "Already expressed" on 409, error message otherwise
  - Add route `/listings/:id` in `App.jsx` wrapped in `<ProtectedRoute roles={['tenant']} />`
  - _Requirements: 9.1, 9.2, 9.3_
  - **Files:** `client/src/pages/ListingDetailPage.jsx`, `client/src/App.jsx`
  - **Done when:** Detail page loads listing data; clicking InterestButton sends request and shows confirmation; second click shows "Already expressed".

- [ ] 53. ChatPage (real-time chat)
  - Implement `client/src/pages/ChatPage.jsx`:
    - On mount: GET `/api/chat/:requestId/messages` → dispatch `SET_MESSAGES`; connect Socket.io with `{ auth: { token } }`; emit `join_chat({ requestId })`; listen for `receive_message` → dispatch `APPEND_MESSAGE`; disconnect on unmount
    - Layout: `flex flex-col h-screen`; message list `flex-1 overflow-y-auto` (each message shows sender name, text, timestamp); input bar `sticky bottom-0` with text input + Send button
    - On send: emit `send_message({ requestId, text })` then clear input
  - Add route `/chat/:requestId` in `App.jsx` wrapped in `<ProtectedRoute roles={['tenant','owner']} />`
  - _Requirements: 11.1, 11.2, 11.3, 12.2, 12.4_
  - **Files:** `client/src/pages/ChatPage.jsx`, `client/src/App.jsx`
  - **Done when:** Historical messages load on mount; new messages appear in real time for both participants; disconnecting on unmount does not cause errors; text > 2000 chars shows error.

- [ ] 54. AdminPage (users + listings + metrics)
  - Implement `client/src/pages/AdminPage.jsx` with three sections in `flex flex-col gap-6`:
    - `UserTable`: GET `/api/admin/users`; columns name, email, role, isDeleted; Delete/Restore buttons → PATCH `/api/admin/users/:id`
    - `ListingTable`: GET `/api/admin/listings`; columns location, rent, status, owner; Delete button → DELETE `/api/admin/listings/:id`
    - `MetricsDashboard`: GET `/api/admin/metrics`; display all four metric fields
  - Add route `/admin` in `App.jsx` wrapped in `<ProtectedRoute roles={['admin']} />`
  - _Requirements: 15.1, 15.2, 15.4, 16.1, 16.2, 17.1_
  - **Files:** `client/src/pages/AdminPage.jsx`, `client/src/App.jsx`
  - **Done when:** Admin sees all users/listings; soft-deleting a user disables their login; metrics panel shows correct counts.

- [ ] 55. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP delivery
- All tasks reference specific requirements for traceability
- Checkpoints ensure each group is independently demonstrable before moving on
- Property tests use **fast-check** with a minimum of 100 iterations each (`{ numRuns: 100 }`)
- Unit + integration tests use **Jest** (backend with `mongodb-memory-server`) and **Vitest** (frontend with `@testing-library/react`)
- All backend tests mock external services (Cloudinary, Gemini, email transport) — no real API calls in CI
- `server/app.js` is the Express factory; `server/index.js` is the entry point that wires HTTP server + Socket.io + DB + seeding
- Cache invalidation for CompatibilityScore is handled in two places: PUT `/api/listings/:id` (listing changed) and PUT `/api/profile` (profile changed)
- The `buildChatSessionId` helper is defined in `server/models/ChatMessage.js` and imported wherever needed (socket.js, chat route)

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "3"] },
    { "id": 1, "tasks": ["2", "4"] },
    { "id": 2, "tasks": ["4.1", "5"] },
    { "id": 3, "tasks": ["5.1", "6"] },
    { "id": 4, "tasks": ["7", "8"] },
    { "id": 5, "tasks": ["9", "10"] },
    { "id": 6, "tasks": ["11", "12", "13"] },
    { "id": 7, "tasks": ["13.1", "14"] },
    { "id": 8, "tasks": ["15"] },
    { "id": 9, "tasks": ["16", "17"] },
    { "id": 10, "tasks": ["18"] },
    { "id": 11, "tasks": ["19"] },
    { "id": 12, "tasks": ["20"] },
    { "id": 13, "tasks": ["20.1", "21"] },
    { "id": 14, "tasks": ["22"] },
    { "id": 15, "tasks": ["22.1", "23"] },
    { "id": 16, "tasks": ["23.1", "23.2", "24"] },
    { "id": 17, "tasks": ["25", "26"] },
    { "id": 18, "tasks": ["27"] },
    { "id": 19, "tasks": ["27.1", "27.2", "28"] },
    { "id": 20, "tasks": ["29"] },
    { "id": 21, "tasks": ["29.1", "29.2", "29.3", "30"] },
    { "id": 22, "tasks": ["31"] },
    { "id": 23, "tasks": ["32", "33"] },
    { "id": 24, "tasks": ["34"] },
    { "id": 25, "tasks": ["35"] },
    { "id": 26, "tasks": ["35.1", "36"] },
    { "id": 27, "tasks": ["37"] },
    { "id": 28, "tasks": ["37.1", "38"] },
    { "id": 29, "tasks": ["39", "40"] },
    { "id": 30, "tasks": ["41"] },
    { "id": 31, "tasks": ["42", "43"] },
    { "id": 32, "tasks": ["44", "45", "46"] },
    { "id": 33, "tasks": ["47"] },
    { "id": 34, "tasks": ["48", "49"] },
    { "id": 35, "tasks": ["50"] },
    { "id": 36, "tasks": ["51", "52"] },
    { "id": 37, "tasks": ["53", "54"] }
  ]
}
```
