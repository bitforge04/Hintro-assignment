# Changelog

A record of implementation milestones and notable changes during development.

---

## [1.0.0] — Initial Release

### Project Setup
- Initialized Node.js project with Express
- Configured Prisma with SQLite
- Set up environment variable loading with dotenv
- Added nodemon for development auto-restart

### Database
- Designed and migrated schema with models: User, Meeting, TranscriptEntry, MeetingAnalysis, ActionItem, ReminderLog
- All IDs are UUIDs
- Transcript entries cascade-delete when a meeting is deleted
- ActionItem soft-links to Meeting (SetNull on delete)

### Authentication
- Implemented POST /api/auth/register with bcrypt password hashing (salt rounds: 10)
- Implemented POST /api/auth/login with JWT signing (7-day expiry)
- Auth middleware validates Bearer tokens on protected routes

### Meeting Management
- POST /api/meetings — creates meeting and transcript entries in a single Prisma transaction
- GET /api/meetings — paginated list with participant count
- GET /api/meetings/:id — full meeting with transcript and analysis if available

### AI Analysis
- Integrated Groq SDK with llama3-70b-8192
- Structured system prompt with explicit hallucination prevention
- Citations required on every generated insight
- POST /api/meetings/:id/analyze stores result via upsert

### Action Items
- POST /api/action-items — create with optional dueDate, meetingId, citations
- PATCH /api/action-items/:id/status — update status
- GET /api/action-items — paginated list with filters (status, assignee, meetingId)
- GET /api/action-items/overdue — returns non-completed items past due date

### Reminder System
- Integrated Resend SDK for transactional email
- Hourly cron job (node-cron) queries overdue items and sends reminders
- ReminderLog record created after each successful send
- Job errors are caught and logged — never crashes the server

### Infrastructure
- Trace ID middleware — generates or passes through x-trace-id on every request
- Centralized error handler as last middleware
- Unified response format (traceId, success, data/error) on every endpoint
- Pino structured logging throughout
- Zod validation on all request bodies
- Swagger docs at /api-docs
- CORS enabled for all origins
- GET /health and GET /api/evaluation endpoints

---

## [1.0.1] — Bug Fixes

### Fixes
- Switched Groq model from `llama3-70b-8192` to `llama-3.3-70b-versatile` after Groq decommissioned the original model
- Removed `mode: "insensitive"` from assignee filter query — SQLite does not support this Prisma option, caused 500 errors on GET /api/action-items

### Improvements
- Added pino-http middleware to log every HTTP request with method, path, status code, and trace ID
- Generated README.md, DECISIONS.md, AI_APPROACH.md, TESTING.md, CHANGELOG.md, CHECKLIST.md
