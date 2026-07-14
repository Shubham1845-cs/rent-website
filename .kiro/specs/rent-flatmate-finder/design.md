# Design Document — Rent & Flatmate Finder

## Overview

The Rent & Flatmate Finder is a MERN-stack web application that connects room owners with
potential tenants using AI-powered compatibility matching. Owners post listings; tenants create
preference profiles; the system scores every tenant-listing pair (via Google Gemini with a
rule-based fallback); and tenants browse ranked results, send interest requests, and chat in
real time once an owner accepts.

The entire backend is a single Express monolith (REST + Socket.io on the same HTTP server)
backed by MongoDB. The frontend is a Vite/React SPA styled with Tailwind CSS. External
dependencies are minimal: Cloudinary for photo storage, Google Gemini API for LLM scoring,
and Resend/Nodemailer for email notifications.

**Key design decisions:**
- **Monolith over microservices** — reduces operational overhead for an interview-scale project; all code lives in one Node process, one codebase, one deploy.
- **Plain JavaScript** — no TypeScript; prioritises readability for evaluation.
- **REST + Socket.io on the same server** — avoids a second service; Socket.io's HTTP upgrade path makes co-location trivial.
- **Score caching in MongoDB** — avoids re-calling the LLM on every browse; a single document per (tenantId, listingId) pair is the cache key.
- **Soft deletes everywhere** — `isDeleted` / `status:"deleted"` flags preserve data integrity and make admin recovery trivial.


---

## Architecture

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                              │
│                                                                      │
│   React (Vite) SPA                                                   │
│   ┌────────────┐  ┌───────────────┐  ┌─────────────────────────┐   │
│   │ AuthContext│  │  React Router │  │  Socket.io-client       │   │
│   └────────────┘  └───────────────┘  └─────────────────────────┘   │
│                            │  HTTP/REST + WS upgrade                 │
└────────────────────────────┼─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND — Express Monolith                        │
│                         (Node.js)                                    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  HTTP Server (http.createServer)                            │    │
│  │  ┌───────────────────────┐  ┌───────────────────────────┐   │    │
│  │  │  Express REST Router  │  │  Socket.io Server         │   │    │
│  │  │  /api/*               │  │  (attached to same server)│   │    │
│  │  └───────────────────────┘  └───────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Middleware: JWT auth, role guard, multer (photo upload)             │
│  Services:  scoringService, emailService, chatService               │
└───────────┬────────────────┬──────────────────┬─────────────────────┘
            │                │                  │
            ▼                ▼                  ▼
   ┌─────────────┐  ┌──────────────────┐  ┌──────────────┐
   │  MongoDB    │  │  Cloudinary API  │  │  Email       │
   │  (Mongoose) │  │  (photo upload)  │  │  (Resend /   │
   └─────────────┘  └──────────────────┘  │  Nodemailer) │
                                          └──────┬───────┘
                                                 │
                                    ┌────────────▼────────────┐
                                    │  Google Gemini API      │
                                    │  (gemini-1.5-flash)     │
                                    └─────────────────────────┘
```

**Request flow (browse listings):**
1. React SPA → `GET /api/listings?location=…&budgetMin=…&budgetMax=…` with `Authorization: Bearer <jwt>`
2. JWT middleware verifies token, attaches `req.user`
3. Route handler checks for a `TenantProfile` for `req.user.id` — if none exists, returns HTTP 400 `{ error: "Please complete your profile before browsing listings" }`; the React `ListingsPage` catches this specific error and redirects to `/dashboard/tenant` (profile setup)
4. Route handler queries MongoDB for non-filled, non-deleted listings matching filters
5. `scoringService.getOrComputeScores(tenantId, profile, listings[])` — fetches cached `CompatibilityScore` docs; calls Gemini (or fallback) for any uncached pairs; persists new scores
6. Response sorted by `score` descending, each listing includes `{ score, explanation }`


---

## Components and Interfaces

### Backend Modules

```
server/
├── index.js                  # Entry: creates httpServer, attaches Socket.io, connects MongoDB, seeds admin
├── app.js                    # Express app factory (routes, middleware, no listen)
├── socket.js                 # Socket.io setup (auth, join_chat, send_message handlers)
├── config/
│   └── db.js                 # Mongoose connection
├── middleware/
│   ├── auth.js               # verifyToken — decodes JWT, sets req.user
│   └── roleGuard.js          # requireRole(...roles) factory
├── models/
│   ├── User.js
│   ├── RoomListing.js
│   ├── TenantProfile.js
│   ├── CompatibilityScore.js
│   ├── InterestRequest.js
│   └── ChatMessage.js
├── routes/
│   ├── auth.js               # POST /register, POST /login
│   ├── listings.js           # CRUD + status
│   ├── profile.js            # GET/PUT /profile
│   ├── interest.js           # POST, GET, PATCH /:id
│   ├── chat.js               # GET /:requestId/messages
│   └── admin.js              # Users, listings, metrics
├── services/
│   ├── scoringService.js     # getOrComputeScores, llmScore, fallbackScore
│   └── emailService.js       # sendHighScoreAlert, sendInterestResponse
└── utils/
    └── adminSeed.js          # Bootstrap admin on startup
```

### Frontend Modules

```
client/src/
├── main.jsx
├── App.jsx                   # React Router routes
├── context/
│   ├── AuthContext.jsx        # user, token — useReducer
│   └── ChatContext.jsx        # messages — useReducer
├── pages/
│   ├── HomePage.jsx
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── ListingsPage.jsx
│   ├── ListingDetailPage.jsx
│   ├── OwnerDashboardPage.jsx
│   ├── TenantDashboardPage.jsx
│   ├── ChatPage.jsx
│   └── AdminPage.jsx
└── components/
    ├── Navbar.jsx
    ├── ListingCard.jsx
    ├── FilterBar.jsx
    └── ProtectedRoute.jsx
```


---

## Data Models

All schemas are flat Mongoose documents with ObjectId refs — no embedding of sub-documents.

### User

```js
{
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['tenant', 'owner', 'admin'], required: true },
  isDeleted:    { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now }
}
```

### RoomListing

```js
{
  ownerId:       { type: ObjectId, ref: 'User', required: true },
  location:      { type: String, required: true, maxlength: 200 },
  rent:          { type: Number, required: true, min: 0 },
  availableFrom: { type: Date, required: true },
  roomType:      { type: String, enum: ['single', 'double', 'studio'], required: true },
  furnishing:    { type: String, enum: ['furnished', 'unfurnished', 'partial'], required: true },
  photos:        [{ type: String }],   // Cloudinary URLs, max 10
  status:        { type: String, enum: ['available', 'filled', 'deleted'], default: 'available' },
  createdAt:     { type: Date, default: Date.now }
}
```

### TenantProfile

```js
{
  tenantId:          { type: ObjectId, ref: 'User', required: true, unique: true },
  preferredLocation: { type: String, required: true, maxlength: 200 },
  budgetMin:         { type: Number, required: true, min: 0 },
  budgetMax:         { type: Number, required: true, min: 0 },
  moveInDate:        { type: Date, required: true },
  createdAt:         { type: Date, default: Date.now }
}
```

### CompatibilityScore

```js
{
  tenantId:    { type: ObjectId, ref: 'User', required: true },
  listingId:   { type: ObjectId, ref: 'RoomListing', required: true },
  score:       { type: Number, required: true, min: 0, max: 100 },
  explanation: { type: String, required: true },
  method:      { type: String, enum: ['llm', 'fallback'], required: true },
  createdAt:   { type: Date, default: Date.now }
}
// Compound unique index: { tenantId: 1, listingId: 1 }
```

### InterestRequest

```js
{
  tenantId:       { type: ObjectId, ref: 'User', required: true },
  listingId:      { type: ObjectId, ref: 'RoomListing', required: true },
  ownerId:        { type: ObjectId, ref: 'User', required: true },
  status:         { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  scoreAtRequest: { type: Number, required: true },
  createdAt:      { type: Date, default: Date.now }
}
// Compound unique index: { tenantId: 1, listingId: 1 }
```

### ChatMessage

```js
{
  chatSessionId: { type: String, required: true },  // sorted+joined tenantId+ownerId, e.g. "aaa_bbb"
  senderId:      { type: ObjectId, ref: 'User', required: true },
  receiverId:    { type: ObjectId, ref: 'User', required: true },
  text:          { type: String, required: true, maxlength: 2000 },
  createdAt:     { type: Date, default: Date.now }
}
// Index: { chatSessionId: 1, createdAt: 1 }
```

**chatSessionId derivation:**
```js
function buildChatSessionId(tenantId, ownerId) {
  return [tenantId.toString(), ownerId.toString()].sort().join('_');
}
```

Sorting ensures the same ID regardless of which party initiates.


---

## LLM Compatibility Scoring

### Scoring Flow

```
getOrComputeScores(tenantId, listings[])
  │
  ├─ Fetch all CompatibilityScore docs for (tenantId, listingIds[])
  │
  ├─ For each listing with NO cached score:
  │    ├─ Try llmScore(profile, listing)  ──timeout 10s──► success → save method:"llm"
  │    └─ On timeout/error → fallbackScore(profile, listing) → save method:"fallback"
  │
  └─ Return all scores (cached + newly computed)
```

### LLM Prompt Template

```
You are a rental compatibility assistant.

Given the following room listing and tenant profile, compute a compatibility
score from 0 to 100 and provide a brief explanation.

LISTING:
- Location: {{listing.location}}
- Rent: ₹{{listing.rent}} per month
- Available From: {{listing.availableFrom | YYYY-MM-DD}}
- Room Type: {{listing.roomType}}
- Furnishing: {{listing.furnishing}}

TENANT PROFILE:
- Preferred Location: {{profile.preferredLocation}}
- Budget Range: ₹{{profile.budgetMin}} – ₹{{profile.budgetMax}} per month
- Desired Move-in Date: {{profile.moveInDate | YYYY-MM-DD}}

Respond ONLY with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "explanation": "<one or two sentence explanation>"
}
```

**Example LLM response:**
```json
{
  "score": 82,
  "explanation": "The listing is in the tenant's preferred area and the rent falls within their budget. The available date is 5 days after their desired move-in date."
}
```

**Parsing strategy:** `JSON.parse(response.text())` — if this throws, or if `score` is not a number 0–100, treat as invalid and invoke fallback.

### 10-Second Timeout

```js
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 10_000);
try {
  const result = await model.generateContent(prompt, { signal: controller.signal });
  clearTimeout(timer);
  // parse result …
} catch (err) {
  // timeout or API error → fallback
}
```

### Rule-Based Fallback Formula

```
fallbackScore(profile, listing) → integer 0–100
```

**Component 1 — Budget (0–50 points):**
```
if (listing.rent >= profile.budgetMin && listing.rent <= profile.budgetMax):
    budgetScore = 50
else:
    distance = min(|listing.rent - profile.budgetMin|, |listing.rent - profile.budgetMax|)
    budgetScore = floor(50 * max(0, 1 - distance / profile.budgetMax))
```
*Rationale: full 50 if rent is within range; score decays linearly as rent moves away from the nearest budget boundary, normalised by budgetMax.*

**Component 2 — Location (0–30 points):**
```
preferredWords = profile.preferredLocation.toLowerCase().split(/\s+/)
listingLocation = listing.location.toLowerCase()

fullWordMatch = preferredWords.every(word => listingLocation.includes(word))
if fullWordMatch:
    locationScore = 30
else if preferredWords.some(word => listingLocation.includes(word)):
    locationScore = 15
else:
    locationScore = 0
```

**Component 3 — Move-in Date (0–20 points):**
```
diffDays = |listing.availableFrom - profile.moveInDate| / 86_400_000

if diffDays <= 7:   dateScore = 20
elif diffDays <= 30: dateScore = 10
else:               dateScore = 0
```

**Total:** `score = budgetScore + locationScore + dateScore`
**Explanation stored:** `"Computed using rule-based fallback"`


---

## REST API Routes

All routes prefixed `/api`. Protected routes require `Authorization: Bearer <token>`.
Error shape: `{ "error": "<message>", "details": {} }`.

### Auth — public

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{ name, email, password, role }` | `{ token, user: { id, name, email, role } }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user: { id, name, email, role } }` |

### Listings — tenant (read), owner (write)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/listings` | tenant | Query params: `location`, `budgetMin`, `budgetMax`. Returns 400 if tenant has no profile. Returns listings with `score` + `explanation`. |
| POST | `/api/listings` | owner | `multipart/form-data` — fields + up to 10 photo files |
| PUT | `/api/listings/:id` | owner | Update own listing |
| DELETE | `/api/listings/:id` | owner | Soft-delete (status → "deleted") |
| PATCH | `/api/listings/:id/status` | owner | Body `{ status: "available"|"filled" }` |

### Tenant Profile

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/profile` | tenant | Returns current tenant's profile |
| PUT | `/api/profile` | tenant | Create or replace profile (upsert) |

### Interest Requests

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/interest` | tenant | Body `{ listingId }`. If no `CompatibilityScore` exists for this (tenantId, listingId) pair, computes it synchronously (LLM → fallback) before creating the request. Stores result as `scoreAtRequest`. |
| GET | `/api/interest` | tenant/owner | Tenant sees own requests; owner sees requests on their listings |
| PATCH | `/api/interest/:id` | owner | Body `{ status: "accepted"|"declined" }` |

### Chat

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/chat/:requestId/messages` | tenant/owner | Fetches the InterestRequest by `requestId`; verifies `req.user.id` equals either `InterestRequest.tenantId` or `InterestRequest.ownerId` — returns HTTP 403 if not. Returns messages in chronological order. |

### Admin

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/users` | All users (passwordHash excluded) |
| PATCH | `/api/admin/users/:id` | Body `{ isDeleted: true|false }` — soft-delete or reactivate |
| GET | `/api/admin/listings` | All listings including filled/deleted |
| DELETE | `/api/admin/listings/:id` | Hard soft-delete (status → "deleted") |
| GET | `/api/admin/metrics` | `{ usersByRole, activeListings, interestByStatus, messagesLast30Days }` |


---

## Socket.io Events

Authentication happens at connection time via `socket.handshake.auth.token` (JWT) — the Socket.io v4 documented pattern. The client connects with `io(SERVER_URL, { auth: { token } })`. The server verifies the token in a middleware; on failure it disconnects with `error: "Unauthorized"`.

**CORS:** Both Express and the Socket.io server constructor must specify `cors({ origin: process.env.CLIENT_URL })`. Without this, Vite's dev server (`:5173`) and Express (`:5000`) are different origins and every fetch/WebSocket upgrade will be blocked silently.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `{ requestId: string }` | Client joins the Socket.io room for this chat session. Server verifies the requesting user is the tenant or owner on the InterestRequest; disconnects on mismatch. |
| `send_message` | `{ requestId: string, text: string }` | Send a message. Server validates text length (≤ 2000 chars), persists to `ChatMessage`, emits `receive_message` to both participants in the room. |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `receive_message` | `{ chatSessionId, senderId, text, createdAt }` | Broadcast to all sockets in the Socket.io room (covers both online parties). |
| `error` | `{ message: string }` | Sent on auth failure, unauthorised room join, or message validation failure. |

### Socket.io Room Naming

```js
// Room key = chatSessionId (same as ChatMessage.chatSessionId)
const roomName = buildChatSessionId(tenantId, ownerId);
socket.join(roomName);
io.to(roomName).emit('receive_message', payload);
```

### Offline Message Delivery

Messages are persisted to MongoDB at send time regardless of recipient online status.
When the recipient reconnects and joins the room, they call `GET /api/chat/:requestId/messages`
(REST) to fetch the full history — no special "delivery queue" is needed.


---

## Email Notification Triggers

Email is fire-and-forget: every call is wrapped in `try/catch`; failure is logged and execution continues.

### Trigger 1 — High-compatibility interest (score > 80)

**When:** `POST /api/interest` completes and `scoreAtRequest > 80`

**Recipient:** Owner of the listing

**Subject:** `"New high-compatibility interest in your listing"`

**Body fields:** tenant name, compatibility score, listing address (location), link to
`/dashboard/owner` (or direct interest URL)

```js
// emailService.js
async function sendHighScoreAlert({ ownerEmail, tenantName, score, listingLocation, interestId }) { … }
```

### Trigger 2 — Interest accepted

**When:** `PATCH /api/interest/:id` sets status to `"accepted"`

**Recipient:** Tenant

**Subject:** `"Your interest was accepted"`

**Body fields:** listing address (location), owner name, link to `/chat/:requestId` to start chatting

### Trigger 3 — Interest declined

**When:** `PATCH /api/interest/:id` sets status to `"declined"`

**Recipient:** Tenant

**Subject:** `"Your interest was declined"`

**Body fields:** listing address (location), owner name, encouragement copy ("Keep browsing — more listings await")

### Error handling

```js
try {
  await emailService.sendHighScoreAlert(…);
} catch (err) {
  console.error('[email] sendHighScoreAlert failed:', err.message);
  // continue — interest request was already saved
}
```


---

## React Component Tree & Page Routes

### Route Map

| Path | Component | Auth guard |
|------|-----------|------------|
| `/` | `HomePage` | none |
| `/login` | `LoginPage` | none |
| `/register` | `RegisterPage` | none |
| `/listings` | `ListingsPage` | tenant |
| `/listings/:id` | `ListingDetailPage` | tenant |
| `/dashboard/owner` | `OwnerDashboardPage` | owner |
| `/dashboard/tenant` | `TenantDashboardPage` | tenant |
| `/chat/:requestId` | `ChatPage` | tenant or owner |
| `/admin` | `AdminPage` | admin |

`ProtectedRoute` wraps guarded routes; it reads from `AuthContext` and redirects to `/login`
on missing/wrong-role token.

### Component Tree

```
App
├── AuthContext.Provider (user, token, dispatch)
│   └── ChatContext.Provider (messages, dispatch)
│       ├── Navbar
│       │     flex justify-between items-center px-6 py-3
│       └── <Routes>
│             ├── / → HomePage
│             ├── /login → LoginPage
│             ├── /register → RegisterPage
│             │
│             ├── /listings → ListingsPage                      [tenant]
│             │     flex flex-col gap-4
│             │     ├── FilterBar
│             │     │     flex flex-wrap gap-2
│             │     └── listing grid
│             │           grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
│             │           └── ListingCard (×N)
│             │                 flex flex-col rounded shadow p-4
│             │
│             ├── /listings/:id → ListingDetailPage             [tenant]
│             │     flex flex-col md:flex-row gap-6
│             │
│             ├── /dashboard/owner → OwnerDashboardPage         [owner]
│             │     flex flex-col gap-4
│             │
│             ├── /dashboard/tenant → TenantDashboardPage       [tenant]
│             │     flex flex-col gap-4
│             │
│             ├── /chat/:requestId → ChatPage                   [tenant|owner]
│             │     flex flex-col h-screen
│             │     ├── message list  (flex-1 overflow-y-auto)
│             │     └── input bar     (sticky bottom-0)
│             │
│             └── /admin → AdminPage                            [admin]
│                   flex flex-col gap-6
```

### State Management

**AuthContext** (`context/AuthContext.jsx`):
```js
const initialState = { user: null, token: null };

function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':  return { user: action.payload.user, token: action.payload.token };
    case 'LOGOUT': return initialState;
    default:       return state;
  }
}
```
Token is read from `localStorage` on app mount; stored on login; cleared on logout.

**ChatContext** (`context/ChatContext.jsx`):
```js
const initialState = { messages: [] };

function chatReducer(state, action) {
  switch (action.type) {
    case 'SET_MESSAGES':    return { messages: action.payload };
    case 'APPEND_MESSAGE':  return { messages: [...state.messages, action.payload] };
    default:                return state;
  }
}
```
`ChatPage` dispatches `SET_MESSAGES` on load (from REST history endpoint) and `APPEND_MESSAGE`
on every `receive_message` Socket.io event.


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Password hashing is irreversible and verifiable

*For any* plaintext password supplied during registration, the value stored in the database
SHALL NOT equal the plaintext password, and `bcrypt.compare(plaintext, stored)` SHALL return `true`.

**Validates: Requirements 1.5**

---

### Property 2: JWT claims completeness

*For any* successfully registered user with any role (`tenant`, `owner`, `admin`), the
Auth_Token returned on login SHALL decode to a payload containing the correct `userId` and
`role` fields, with expiry approximately 24 hours from issue time.

**Validates: Requirements 1.3, 1.6**

---

### Property 3: Duplicate registration is rejected

*For any* email address, if a user with that email already exists, a subsequent registration
attempt with the same email SHALL return an error containing "Email already registered" and
SHALL NOT create a second user document.

**Validates: Requirements 1.2**

---

### Property 4: Role-based access control invariant

*For any* HTTP request to a protected endpoint, the server SHALL grant access if and only if
the request carries a valid, non-expired JWT whose `role` claim satisfies the endpoint's
required role(s). Requests with no token or wrong role SHALL receive 401 or 403 respectively.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

### Property 5: Listing ownership enforcement

*For any* two distinct owners A and B, owner A SHALL receive HTTP 403 when attempting to
update or delete a listing created by owner B.

**Validates: Requirements 4.7**

---

### Property 6: Listing filter correctness

*For any* combination of `location`, `budgetMin`, and `budgetMax` filter parameters, every
listing in the response SHALL satisfy ALL applied constraints simultaneously: location contains
the filter text (case-insensitive), rent is within [budgetMin, budgetMax] (inclusive), and
status is neither "filled" nor "deleted".

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

---

### Property 7: Browse results include score and explanation

*For any* listing returned by the browse endpoint, the response object SHALL include a
non-null `score` (integer 0–100) and a non-empty `explanation` string.

**Validates: Requirements 6.5, 7.4, 7.7**

---

### Property 8: Score caching (LLM called at most once per pair)

*For any* (tenantId, listingId) pair for which a `CompatibilityScore` document already
exists, a subsequent call to `getOrComputeScores` SHALL return the cached score without
invoking the LLM API.

**Validates: Requirements 7.2, 7.5**

---

### Property 9: Rule-based fallback formula correctness

*For any* valid `(profile, listing)` pair, when the fallback scorer is invoked it SHALL
return a score equal to `budgetComponent + locationComponent + dateComponent` where:

- `budgetComponent` = 50 if `budgetMin ≤ rent ≤ budgetMax`; else `floor(50 * max(0, 1 - min(|rent−budgetMin|, |rent−budgetMax|) / budgetMax))`
- `locationComponent` = 30 if all words in `preferredLocation` appear in `listing.location` (case-insensitive); 15 if any word matches; 0 otherwise
- `dateComponent` = 20 if `|availableFrom − moveInDate| ≤ 7 days`; 10 if `≤ 30 days`; 0 otherwise

The returned score SHALL be an integer in [0, 100].

**Validates: Requirements 8.3**

---

### Property 10: No duplicate interest requests

*For any* (tenantId, listingId) pair for which an `InterestRequest` already exists,
a second `POST /api/interest` with the same pair SHALL return an error containing
"Interest already expressed" and SHALL NOT create a second request document.

**Validates: Requirements 9.2**

---

### Property 11: Interest captures score at request time

*For any* interest request successfully created, `scoreAtRequest` SHALL equal the
`CompatibilityScore.score` value that existed for the same (tenantId, listingId) pair
at the moment the request was created.

**Validates: Requirements 9.4**

---

### Property 12: Interest status transitions are owner-gated

*For any* interest request, an `PATCH /api/interest/:id` call from a user who is NOT the
owner of the associated listing SHALL return HTTP 403, regardless of the requested status.

**Validates: Requirements 10.3**

---

### Property 13: Chat message persistence round-trip

*For any* sequence of messages sent in a Chat_Session, a subsequent `GET /api/chat/:requestId/messages`
request SHALL return all those messages in chronological (createdAt ascending) order, with each
message containing the correct `senderId`, `text`, and `createdAt`.

**Validates: Requirements 12.1, 12.2**

---

### Property 14: Email triggered on high-score interest

*For any* interest request where `scoreAtRequest > 80`, the email service SHALL be called
exactly once with the owner's email address. For any interest request where `scoreAtRequest ≤ 80`,
the email service SHALL NOT be called.

**Validates: Requirements 13.1**

---

### Property 15: Email triggered on interest status change

*For any* interest request whose status transitions to `"accepted"`, an email SHALL be sent to
the tenant with subject "Your interest was accepted". *For any* transition to `"declined"`, an
email SHALL be sent to the tenant with subject "Your interest was declined".

**Validates: Requirements 14.1, 14.2**

---

### Property 16: Soft-delete prevents login; reactivation restores it

*For any* user account marked `isDeleted: true`, a login attempt with valid credentials SHALL
be rejected. After the same account is reactivated (`isDeleted: false`), login with the same
valid credentials SHALL succeed.

**Validates: Requirements 15.2, 15.4**

---

### Property 17: Validation errors use consistent JSON format

*For any* request with missing required fields or invalid field formats, the error response
SHALL be a JSON object with at minimum an `error` string field, conforming to
`{ error: string, details: object }`.

**Validates: Requirements 21.1, 21.2, 21.4**


---

## Error Handling

### HTTP Error Conventions

| Status | Meaning | When |
|--------|---------|------|
| 400 | Bad Request | Missing/invalid fields, constraint violations (negative rent, budgetMin > budgetMax) |
| 401 | Unauthorized | No token, expired token, invalid token |
| 403 | Forbidden | Valid token but insufficient role or resource ownership |
| 404 | Not Found | Resource does not exist or is soft-deleted |
| 409 | Conflict | Duplicate (email, interest request) |
| 500 | Internal Server Error | Unhandled exceptions |

All error responses use:
```json
{ "error": "<human-readable message>", "details": {} }
```
`details` is an object with field-level validation errors when applicable (e.g., `{ "rent": "must be non-negative" }`); empty object otherwise.

### Global Express Error Handler

```js
// app.js — last middleware
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error', details: err.details || {} });
});
```

### Async Wrapper

Every route handler is wrapped in `asyncHandler(fn)` (a tiny utility that calls `next(err)` on
rejection), keeping route files free of try/catch boilerplate.

### LLM / Email Failures

- LLM timeout or error → caught in `scoringService`, fallback invoked, logged to `console.error`
- Email failure → caught in route handler after `emailService` call, logged, processing continues

### Socket.io Errors

Emitted as `error` event to the offending socket only; server continues running.


---

## Testing Strategy

### Dual Testing Approach

The test suite uses two complementary layers:

1. **Unit / integration tests** — specific scenarios, edge cases, and error conditions, using
   a real in-memory MongoDB instance (via `mongodb-memory-server`) and mocked external services
   (Cloudinary, Gemini, email). Framework: **Jest** (backend), **Vitest** (frontend).

2. **Property-based tests** — universal properties executed over many randomly generated inputs.
   Framework: **fast-check** (JavaScript). Each property test runs a minimum of **100 iterations**.

### Property-Based Testing Library

**[fast-check](https://fast-check.dev/)** is used for all property tests.

```js
const fc = require('fast-check');

// Example: Property 9 — fallback formula correctness
test('fallback score stays in [0,100] for any valid profile+listing', () => {
  fc.assert(
    fc.property(
      fc.record({
        budgetMin: fc.integer({ min: 0, max: 50_000 }),
        budgetMax: fc.integer({ min: 0, max: 100_000 }),
        preferredLocation: fc.string({ minLength: 1, maxLength: 200 }),
        moveInDate: fc.date(),
      }),
      fc.record({
        rent: fc.integer({ min: 0, max: 150_000 }),
        location: fc.string({ minLength: 1, maxLength: 200 }),
        availableFrom: fc.date(),
      }),
      (profile, listing) => {
        if (profile.budgetMin > profile.budgetMax) return true; // skip invalid
        const result = fallbackScore(profile, listing);
        return result.score >= 0 && result.score <= 100;
      }
    ),
    { numRuns: 100 }
  );
});
// Feature: rent-flatmate-finder, Property 9: Rule-based fallback formula correctness
```

### Test Tag Format

Every property test includes a comment:
```
// Feature: rent-flatmate-finder, Property <N>: <property title>
```

### Test Coverage by Layer

| Layer | Scope | Tool |
|-------|-------|------|
| Property tests | Properties 1–17 (all testable) | fast-check + Jest |
| Unit tests | Specific edge cases: negative rent, 11 photos, 2001-char message, filled listing interest | Jest |
| Integration tests | Socket.io message delivery, LLM mock + caching, Cloudinary mock, email mock | Jest + supertest |
| Frontend component tests | Navbar render, FilterBar filter emission, ChatPage message append | Vitest + Testing Library |

### Unit Test Focus Areas

- `scoringService.fallbackScore` — boundary values (rent exactly at budgetMin/budgetMax, diff = 7 days, diff = 30 days)
- `scoringService.llmScore` — mock Gemini returning invalid JSON → fallback triggered
- `emailService` — mock transport, verify `sendMail` called with correct subject/recipient
- Validation middleware — missing required fields returns 400 with `{ error, details }`

### Integration Test Focus Areas

- `POST /api/auth/register` → duplicate email → 409
- `GET /api/listings` with filters → only matching listings returned, sorted by score
- `PATCH /api/interest/:id` → wrong owner → 403; correct owner → status updated + email sent
- Socket.io: connect with valid JWT → `join_chat` → `send_message` → `receive_message` emitted to both parties

