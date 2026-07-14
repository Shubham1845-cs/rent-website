# Rent & Flatmate Finder

AI-powered MERN-stack platform connecting room owners with tenants using smart compatibility matching, real-time chat, and email notifications.

## Features

- 🤖 **AI Compatibility Scoring** — Google Gemini scores every tenant–listing pair (0–100) with a natural-language explanation. Falls back to a deterministic rule-based scorer if the LLM is unavailable.
- 💬 **Real-Time Chat** — Socket.io-powered bidirectional chat, activated once an owner accepts an interest request. Messages persisted in MongoDB.
- 🔔 **Email Notifications** — Owner alerted on high-score (>80) interest; tenant notified on accept/decline.
- 🔐 **Role-Based Auth** — JWT auth with three roles: tenant, owner, admin.
- 🏠 **Listing Management** — Owners post listings with photos (Cloudinary), mark as filled, edit, soft-delete.
- 📊 **Admin Panel** — User management (soft-delete/reactivate), listing oversight, platform metrics.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js · Express · Socket.io · Mongoose |
| Database | MongoDB |
| Frontend | React 18 · Vite · Tailwind CSS |
| AI | Google Gemini (`gemini-1.5-flash`) |
| Storage | Cloudinary |
| Auth | JWT (24h expiry) · bcrypt |
| Email | Nodemailer (SMTP / Resend) |

---

## Quick Start (≤ 30 minutes)

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (`mongodb://localhost:27017`) or a MongoDB Atlas URI
- Cloudinary account (free tier works)
- Google Gemini API key (free tier works)

### 1. Clone & install

```bash
git clone <repo-url>
cd rent-flatmate-finder

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env with your real values (see table below)
```

| Variable | Description |
|----------|-------------|
| `PORT` | Express port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Random secret for JWT signing |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard |
| `GEMINI_API_KEY` | From Google AI Studio |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password |
| `CLIENT_URL` | Frontend URL (default `http://localhost:5173`) |
| `EMAIL_HOST` | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (587 for TLS) |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password / app password |

### 3. Run

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open http://localhost:5173

---

## API Reference

All endpoints prefixed `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/auth/register` | `{name,email,password,role}` | `{token,user}` |
| POST | `/api/auth/login` | `{email,password}` | `{token,user}` |

### Listings

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/listings` | tenant | Query: `location`, `budgetMin`, `budgetMax`. Returns scored listings. |
| GET | `/api/listings/mine` | owner | Owner's own listings (all statuses) |
| GET | `/api/listings/:id` | any | Single listing + score if tenant with profile |
| POST | `/api/listings` | owner | `multipart/form-data` with photos |
| PUT | `/api/listings/:id` | owner | Update own listing |
| DELETE | `/api/listings/:id` | owner | Soft delete |
| PATCH | `/api/listings/:id/status` | owner | `{status: "available"|"filled"}` |

### Profile

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/profile` | tenant | Get own profile |
| PUT | `/api/profile` | tenant | Create or update profile (upsert) |

### Interest Requests

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/interest` | tenant | `{listingId}` |
| GET | `/api/interest` | tenant/owner | Role-filtered |
| PATCH | `/api/interest/:id` | owner | `{status: "accepted"|"declined"}` |

### Chat

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/chat/:requestId/messages` | tenant/owner | Chronological history |

### Admin

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/users` | All users (no password) |
| PATCH | `/api/admin/users/:id` | `{isDeleted:bool}` |
| GET | `/api/admin/listings` | All listings |
| DELETE | `/api/admin/listings/:id` | Soft delete |
| GET | `/api/admin/metrics` | `{usersByRole,activeListings,interestByStatus,messagesLast30Days}` |

---

## Database Schema

### User
```json
{ "name": "string", "email": "string(unique)", "passwordHash": "string", "role": "tenant|owner|admin", "isDeleted": "boolean", "createdAt": "Date" }
```

### RoomListing
```json
{ "ownerId": "ObjectId→User", "location": "string(max200)", "rent": "number≥0", "availableFrom": "Date", "roomType": "single|double|studio", "furnishing": "furnished|unfurnished|partial", "photos": ["url"], "status": "available|filled|deleted", "createdAt": "Date" }
```

### TenantProfile
```json
{ "tenantId": "ObjectId→User(unique)", "preferredLocation": "string(max200)", "budgetMin": "number≥0", "budgetMax": "number≥0", "moveInDate": "Date", "createdAt": "Date" }
```

### CompatibilityScore
```json
{ "tenantId": "ObjectId→User", "listingId": "ObjectId→RoomListing", "score": "0–100", "explanation": "string", "method": "llm|fallback", "createdAt": "Date" }
// compound unique index: (tenantId, listingId)
```

### InterestRequest
```json
{ "tenantId": "ObjectId→User", "listingId": "ObjectId→RoomListing", "ownerId": "ObjectId→User", "status": "pending|accepted|declined", "scoreAtRequest": "number", "createdAt": "Date" }
// compound unique index: (tenantId, listingId)
```

### ChatMessage
```json
{ "chatSessionId": "string", "senderId": "ObjectId→User", "receiverId": "ObjectId→User", "text": "string(max2000)", "createdAt": "Date" }
// index: (chatSessionId, createdAt)
```

---

## LLM Prompt

```
You are a rental compatibility assistant.

Given the following room listing and tenant profile, compute a compatibility
score from 0 to 100 and provide a brief explanation.

LISTING:
- Location: {{listing.location}}
- Rent: ₹{{listing.rent}} per month
- Available From: {{listing.availableFrom}}
- Room Type: {{listing.roomType}}
- Furnishing: {{listing.furnishing}}

TENANT PROFILE:
- Preferred Location: {{profile.preferredLocation}}
- Budget Range: ₹{{profile.budgetMin}} – ₹{{profile.budgetMax}} per month
- Desired Move-in Date: {{profile.moveInDate}}

Respond ONLY with valid JSON in this exact format:
{ "score": <integer 0-100>, "explanation": "<one or two sentence explanation>" }
```

**Example response:**
```json
{ "score": 82, "explanation": "The listing is in the tenant's preferred area and the rent falls within their budget. The available date is 5 days after their desired move-in date." }
```

---

## Running Tests

```bash
cd server && npm test
```

Tests use **Jest** + **mongodb-memory-server** (in-memory MongoDB, no real DB needed) and **fast-check** for property-based tests.
