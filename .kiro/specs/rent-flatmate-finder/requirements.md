# Requirements Document

## Introduction

The Rent & Flatmate Finder platform connects room owners with potential tenants through AI-powered compatibility matching. Owners post room listings with details like location, rent, and availability. Tenants create profiles with their preferences and budget constraints. The system uses an LLM-based compatibility engine to score tenant-listing matches, enabling tenants to browse ranked results. When a tenant expresses interest and an owner accepts, both parties can communicate via real-time chat. Email notifications keep users informed of significant events.

This platform is designed for simplicity, readability, and explainability using the MERN stack with plain JavaScript, monolith architecture, and standard patterns.

## Glossary

- **Platform**: The Rent & Flatmate Finder web application
- **User**: Any authenticated person using the platform (tenant, owner, or admin)
- **Tenant**: A user with the tenant role who searches for rooms
- **Owner**: A user with the owner role who lists rooms for rent
- **Admin**: A user with the admin role who manages the platform
- **Listing**: A room advertisement posted by an owner
- **Profile**: A tenant's preferences including location, budget, and move-in date
- **Compatibility_Score**: A numeric value (0-100) representing tenant-listing match quality
- **Interest_Request**: A tenant's expression of interest in a listing
- **Chat_Session**: A real-time messaging channel between tenant and owner
- **LLM**: Large Language Model (Google Gemini gemini-1.5-flash)
- **Rule_Based_Scorer**: Fallback algorithm for computing compatibility without LLM
- **JWT**: JSON Web Token used for authentication
- **WebSocket**: Real-time bidirectional communication protocol (Socket.io)
- **Auth_Token**: JWT access token containing user ID and role

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a visitor, I want to register and log in with a specific role, so that I can access role-appropriate features.

#### Acceptance Criteria

1. WHEN a visitor submits valid registration data with email, password, name, and role (tenant or owner), THE Platform SHALL create a new User account
2. WHEN registration data contains an email already in use, THE Platform SHALL return an error message "Email already registered"
3. WHEN a User submits valid login credentials, THE Platform SHALL return an Auth_Token valid for 24 hours
4. WHEN a User submits invalid login credentials, THE Platform SHALL return an error message "Invalid credentials"
5. THE Platform SHALL store passwords using bcrypt hashing with salt rounds of 10 or higher
6. THE Auth_Token SHALL contain user ID and role as claims
7. THE Platform SHALL return the Auth_Token in the JSON response body; the frontend SHALL store it in localStorage and attach it as a Bearer token in the Authorization header for all subsequent requests
8. THE Platform SHALL accept the Auth_Token from the Authorization header (format: "Bearer {token}") for WebSocket connections via the handshake query parameter "token"

### Requirement 2: Admin Account Bootstrap

**User Story:** As a platform operator, I want an initial admin account to be available on startup, so that I can access admin features without a manual database step.

#### Acceptance Criteria

1. WHEN the Platform starts and no User with role "admin" exists in the database, THE Platform SHALL create an Admin account using ADMIN_EMAIL and ADMIN_PASSWORD values from environment variables
2. WHEN ADMIN_EMAIL or ADMIN_PASSWORD environment variables are absent at startup, THE Platform SHALL log a warning and skip admin seeding
3. WHEN an Admin account already exists, THE Platform SHALL skip seeding on subsequent startups
4. THE Platform SHALL hash the seeded admin password with bcrypt before storing it

### Requirement 3: Role-Based Access Control

**User Story:** As a platform operator, I want users to access only features appropriate to their role, so that data integrity and security are maintained.

#### Acceptance Criteria

1. WHEN a Tenant attempts to access owner-only endpoints, THE Platform SHALL return HTTP 403 Forbidden
2. WHEN an Owner attempts to access tenant-only endpoints, THE Platform SHALL return HTTP 403 Forbidden
3. WHEN an Admin attempts to access any endpoint, THE Platform SHALL grant access
4. WHEN a request contains no Auth_Token, THE Platform SHALL return HTTP 401 Unauthorized for protected endpoints
5. WHEN a request contains an expired or invalid Auth_Token, THE Platform SHALL return HTTP 401 Unauthorized

### Requirement 4: Owner Listing Management

**User Story:** As an owner, I want to post and manage room listings with details and photos, so that tenants can discover my available rooms.

#### Acceptance Criteria

1. WHEN an Owner submits a new listing with location, rent amount, available from date, room type, and furnishing status, THE Platform SHALL create the Listing
2. WHEN a listing contains rent amount less than zero, THE Platform SHALL return an error message "Rent must be non-negative"
3. WHEN an Owner uploads up to 10 photos for a listing, THE Platform SHALL upload each file to Cloudinary (or equivalent object storage), store only the returned URL in the Listing document, and associate them with the Listing
4. WHEN an Owner uploads more than 10 photos, THE Platform SHALL return an error message "Maximum 10 photos allowed"
5. WHEN an Owner requests to update their own listing, THE Platform SHALL apply the changes
6. WHEN an Owner requests to delete their own listing, THE Platform SHALL mark the listing as deleted
7. WHEN an Owner attempts to modify another owner's listing, THE Platform SHALL return HTTP 403 Forbidden
8. THE Platform SHALL accept photo uploads in JPEG, PNG, or WebP formats with maximum size 5MB per file

### Requirement 4: Owner Listing Status Management

**User Story:** As an owner, I want to mark a listing as filled, so that it is hidden from tenant searches.

#### Acceptance Criteria

1. WHEN an Owner marks their listing as filled, THE Platform SHALL set the listing status to "filled"
2. WHEN a listing status is "filled", THE Platform SHALL exclude it from search results
3. WHEN an Owner marks a filled listing as available again, THE Platform SHALL include it in search results

### Requirement 5: Tenant Profile Management

**User Story:** As a tenant, I want to create and manage my profile with location, budget, and move-in date preferences, so that the system can match me with suitable listings.

#### Acceptance Criteria

1. WHEN a Tenant submits profile data with preferred location, minimum budget, maximum budget, and move-in date, THE Platform SHALL create or update the Profile
2. WHEN profile data contains minimum budget greater than maximum budget, THE Platform SHALL return an error message "Minimum budget must not exceed maximum budget"
3. WHEN a Tenant requests to view their profile, THE Platform SHALL return the current Profile data
4. THE Platform SHALL store preferred location as city or neighborhood text with maximum length 200 characters

### Requirement 6: Tenant Listing Discovery

**User Story:** As a tenant, I want to browse and filter listings ranked by compatibility, so that I can find rooms that match my preferences.

#### Acceptance Criteria

1. WHEN a Tenant requests the listings browse endpoint, THE Platform SHALL return all Listings where status is not "filled" and not "deleted", ranked by Compatibility_Score in descending order
2. WHEN a Tenant applies a location filter, THE Platform SHALL return only Listings whose location contains the filter text (case-insensitive)
3. WHEN a Tenant applies a budget filter with minimum and maximum values, THE Platform SHALL return only Listings whose rent falls within the range (inclusive)
4. WHEN a Tenant applies both location and budget filters, THE Platform SHALL return Listings matching both criteria
5. FOR ALL returned Listings, THE Platform SHALL include the Compatibility_Score and explanation

### Requirement 7: AI Compatibility Scoring with LLM

**User Story:** As a tenant, I want compatibility scores computed using AI, so that I can see how well each listing matches my preferences.

#### Acceptance Criteria

1. WHEN a Tenant requests the listings browse endpoint, THE Platform SHALL compute (or fetch cached) Compatibility_Scores for all returned Listings before ranking and returning results
2. WHEN no cached Compatibility_Score exists for a tenant-listing pair, THE Platform SHALL compute the score by calling the LLM
3. THE Platform SHALL send a prompt to the LLM containing listing details (location, rent, dates, room type, furnishing) and Profile preferences (location, budget range, move-in date)
4. WHEN the LLM returns a response with score (0-100) and explanation, THE Platform SHALL store both in the database associated with the tenant-listing pair
5. WHEN a Compatibility_Score exists in the database for a tenant-listing pair, THE Platform SHALL return the cached score without invoking the LLM
6. THE Platform SHALL use Google Gemini model "gemini-1.5-flash" for scoring
7. THE LLM prompt SHALL request JSON format response: { score: number, explanation: string }

### Requirement 8: Compatibility Scoring Fallback

**User Story:** As a tenant, I want to see compatibility scores even when the AI service fails, so that I can continue browsing listings without interruption.

#### Acceptance Criteria

1. WHEN the LLM fails to respond within 10 seconds, THE Platform SHALL invoke the Rule_Based_Scorer
2. WHEN the LLM returns an error or invalid response, THE Platform SHALL invoke the Rule_Based_Scorer
3. THE Rule_Based_Scorer SHALL compute a score based on: budget overlap (50 points), location text similarity (30 points), and move-in date proximity (20 points)
4. WHEN the Rule_Based_Scorer computes a score, THE Platform SHALL store the score with explanation "Computed using rule-based fallback"
5. THE Platform SHALL log LLM failures for monitoring purposes

### Requirement 9: Interest Request Management

**User Story:** As a tenant, I want to send interest requests to owners, so that I can express my desire to rent their room.

#### Acceptance Criteria

1. WHEN a Tenant sends an Interest_Request for a Listing, THE Platform SHALL create the request with status "pending"
2. WHEN a Tenant sends an Interest_Request for a Listing they have already requested, THE Platform SHALL return an error message "Interest already expressed"
3. WHEN a Tenant sends an Interest_Request for a filled Listing, THE Platform SHALL return an error message "Listing is no longer available"
4. THE Interest_Request SHALL include the Compatibility_Score at the time of request

### Requirement 10: Owner Interest Response

**User Story:** As an owner, I want to accept or decline interest requests, so that I can choose which tenants to communicate with.

#### Acceptance Criteria

1. WHEN an Owner accepts an Interest_Request for their listing, THE Platform SHALL set the request status to "accepted"
2. WHEN an Owner declines an Interest_Request for their listing, THE Platform SHALL set the request status to "declined"
3. WHEN an Owner attempts to respond to an Interest_Request for another owner's listing, THE Platform SHALL return HTTP 403 Forbidden
4. WHEN an Interest_Request status is "accepted", THE Platform SHALL create a Chat_Session between the Tenant and Owner

### Requirement 11: Real-Time Chat via WebSocket

**User Story:** As a user with accepted interest, I want to chat in real time with the other party, so that we can discuss rental details.

#### Acceptance Criteria

1. WHEN a User connects to a Chat_Session via WebSocket, THE Platform SHALL authenticate using the Auth_Token
2. WHEN an authenticated User sends a message in their Chat_Session, THE Platform SHALL deliver the message to the other party in real time
3. WHEN a User is offline, THE Platform SHALL store undelivered messages for retrieval when they reconnect
4. THE Platform SHALL use Socket.io for WebSocket implementation
5. WHEN a User attempts to join a Chat_Session they are not a member of, THE Platform SHALL close the WebSocket connection with error "Unauthorized"

### Requirement 12: Chat Message Persistence

**User Story:** As a user, I want chat messages saved permanently, so that I can review conversation history.

#### Acceptance Criteria

1. WHEN a message is sent in a Chat_Session, THE Platform SHALL store it in the database with sender ID, receiver ID, message text, and timestamp
2. WHEN a User requests chat history for their Chat_Session, THE Platform SHALL return all messages in chronological order
3. THE Platform SHALL store messages with maximum text length 2000 characters
4. WHEN a message exceeds 2000 characters, THE Platform SHALL return an error message "Message too long"

### Requirement 13: Email Notification for High-Compatibility Interest

**User Story:** As an owner, I want email notifications when a high-compatibility tenant expresses interest, so that I can respond promptly to promising matches.

#### Acceptance Criteria

1. WHEN a Tenant with Compatibility_Score above 80 sends an Interest_Request, THE Platform SHALL send an email notification to the Owner
2. THE email SHALL contain tenant name, compatibility score, listing address, and a link to view the interest request
3. WHEN the email service fails, THE Platform SHALL log the failure and continue processing the Interest_Request
4. THE Platform SHALL use Resend or Nodemailer with Gmail for email delivery

### Requirement 14: Email Notification for Interest Response

**User Story:** As a tenant, I want email notifications when an owner responds to my interest, so that I know the outcome immediately.

#### Acceptance Criteria

1. WHEN an Owner accepts an Interest_Request, THE Platform SHALL send an email notification to the Tenant with subject "Your interest was accepted"
2. WHEN an Owner declines an Interest_Request, THE Platform SHALL send an email notification to the Tenant with subject "Your interest was declined"
3. THE email SHALL contain listing address, owner name, and next steps (chat link for accepted, encouragement to continue searching for declined)
4. WHEN the email service fails, THE Platform SHALL log the failure and continue processing the response

### Requirement 15: Admin User Management

**User Story:** As an admin, I want to manage user accounts, so that I can maintain platform integrity.

#### Acceptance Criteria

1. WHEN an Admin requests the list of all Users, THE Platform SHALL return user details excluding passwords
2. WHEN an Admin deletes a User account, THE Platform SHALL mark the account as deleted and prevent future logins
3. WHEN an Admin attempts to view User passwords, THE Platform SHALL return HTTP 403 Forbidden
4. WHEN an Admin reactivates a deleted User account, THE Platform SHALL restore login access

### Requirement 16: Admin Listing Management

**User Story:** As an admin, I want to manage all listings, so that I can remove inappropriate content.

#### Acceptance Criteria

1. WHEN an Admin requests all Listings, THE Platform SHALL return listings from all Owners including filled and deleted listings
2. WHEN an Admin deletes a Listing, THE Platform SHALL mark it as deleted and exclude it from searches
3. WHEN an Admin updates a Listing, THE Platform SHALL apply the changes regardless of ownership

### Requirement 17: Admin Activity Monitoring

**User Story:** As an admin, I want to view platform activity metrics, so that I can understand usage patterns.

#### Acceptance Criteria

1. WHEN an Admin requests activity metrics, THE Platform SHALL return total user count by role, total active listings, total interest requests by status, and total messages sent in the last 30 days
2. THE Platform SHALL compute metrics from database records without caching

### Requirement 18: Code Simplicity and Readability

**User Story:** As a developer or interviewer, I want the codebase to be simple and readable, so that I can understand and evaluate architectural decisions.

#### Acceptance Criteria

1. THE Platform SHALL use plain JavaScript without TypeScript for all code
2. THE Platform SHALL implement the backend as a single monolithic Express application
3. EACH frontend component SHALL have a single, clearly defined responsibility
4. THE Platform SHALL use React Context with useReducer for state management without Redux
5. THE Platform SHALL use Tailwind CSS exclusively for styling without component libraries like MUI or shadcn
6. EACH source file SHALL be independently explainable with clear purpose and minimal dependencies

### Requirement 19: Explainability and Documentation

**User Story:** As a developer or interviewer, I want clear documentation explaining all architectural decisions, so that I can evaluate the design rationale.

#### Acceptance Criteria

1. THE Platform SHALL include a README file with setup guide, environment variable examples, API documentation, database schema, and LLM prompt with example input and output
2. THE Platform SHALL include a system design document (maximum 800 words) covering compatibility scoring design, LLM integration and fallback, chat implementation, and notification flow
3. EACH architectural decision in the system design document SHALL include clear justification
4. THE README SHALL enable a developer to set up and run the application within 30 minutes

### Requirement 20: Non-Functional Performance Requirements

**User Story:** As a user, I want the platform to respond quickly, so that I have a smooth experience.

#### Acceptance Criteria

1. WHEN a User requests to view listings, THE Platform SHALL respond within 2 seconds under normal load (10 concurrent users)
2. WHEN a WebSocket message is sent, THE Platform SHALL deliver it to the recipient within 500 milliseconds when both parties are online
3. WHEN the database contains up to 10,000 listings, THE Platform SHALL maintain response times within specified limits
4. THE Platform SHALL handle up to 50 concurrent WebSocket connections without degradation

### Requirement 21: Data Validation and Error Handling

**User Story:** As a user, I want clear error messages when I submit invalid data, so that I can correct my input.

#### Acceptance Criteria

1. WHEN a User submits data missing required fields, THE Platform SHALL return an error message listing all missing fields
2. WHEN a User submits data with invalid format (e.g., non-numeric rent, invalid date), THE Platform SHALL return an error message specifying the validation failure
3. THE Platform SHALL validate all input data before processing to prevent database corruption
4. ALL error responses SHALL use consistent JSON format: { error: string, details: object }
