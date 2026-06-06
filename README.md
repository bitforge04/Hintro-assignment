# Meeting Intelligence Service

A backend service that helps teams get more out of their meetings. It stores transcripts, uses AI to pull out summaries, action items, decisions, and follow-ups — all grounded in what was actually said. It also tracks action items and sends email reminders when things are overdue.

---

## What it does

- JWT-based authentication
- Create meetings with full transcripts
- AI-powered meeting analysis (summary, action items, decisions, follow-ups) via Groq
- Every AI insight is cited back to a specific transcript timestamp — no hallucinations
- Action item tracking with status updates (PENDING → IN_PROGRESS → COMPLETED)
- Overdue detection for action items
- Hourly scheduled job that emails reminders for overdue items via Resend
- Consistent response format with trace IDs on every request
- Swagger docs at `/api-docs`

---

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | SQLite via Prisma ORM |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| AI | Groq SDK (llama-3.3-70b-versatile) |
| Email | Resend |
| Scheduler | node-cron |
| Validation | Zod |
| Logging | Pino + pino-http |
| Docs | swagger-jsdoc + swagger-ui-express |

---

## Prerequisites

- Node.js v18+
- npm

---

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd meeting-intelligence
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="any-long-random-string"
GROQ_API_KEY="your-groq-api-key"
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="you@yourdomain.com"
PORT=3000
```

**Where to get keys:**
- Groq → https://console.groq.com (free)
- Resend → https://resend.com (free tier, 3000 emails/month)

### 4. Run the database migration

```bash
npx prisma migrate dev --name init
```

This creates `dev.db` and all the tables.

### 5. Start the server

```bash
# Development (auto-restarts on changes)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000` by default.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file path |
| `JWT_SECRET` | Yes | Secret used to sign JWTs |
| `GROQ_API_KEY` | Yes | Groq API key for AI analysis |
| `RESEND_API_KEY` | Yes | Resend API key for emails |
| `RESEND_FROM_EMAIL` | Yes | Sender email address |
| `PORT` | No | Port to listen on (default: 3000) |

---

## API Documentation

Swagger UI is available at:

```
http://localhost:3000/api-docs
```

---

## Quick API Examples

### Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

### Create a Meeting

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Sprint Planning",
    "participants": ["alice@example.com", "bob@example.com"],
    "meetingDate": "2026-05-20T10:00:00Z",
    "transcript": [
      {"timestamp": "00:10", "speaker": "John", "text": "We should launch next Friday."},
      {"timestamp": "00:20", "speaker": "Alice", "text": "I will prepare release notes."}
    ]
  }'
```

### Analyze a Meeting

```bash
curl -X POST http://localhost:3000/api/meetings/<meeting-id>/analyze \
  -H "Authorization: Bearer <token>"
```

### Health Check

```bash
curl http://localhost:3000/health
```

---

## Deployment

The app can be deployed to any Node.js-compatible platform (Render, Railway, Fly.io).

Steps:
1. Set environment variables on the platform
2. Run `npx prisma migrate deploy` on first deploy
3. Start with `npm start`
