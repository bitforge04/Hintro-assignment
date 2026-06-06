# Technical Decisions

This document explains the key decisions made while building the Meeting Intelligence Service, why each choice was made, and what alternatives were considered.

---

## 1. Database: SQLite via Prisma

**Choice:** SQLite with Prisma ORM

**Why:**
SQLite requires zero setup — no separate database server, no connection strings to manage, no Docker needed. For a service at this scale and for local development and evaluation, it's the most friction-free choice. Prisma gives us type-safe queries, migrations, and an easy path to swap databases later.

**Alternatives considered:**
- PostgreSQL — great for production, but requires a running server and more setup overhead for a take-home project
- MongoDB — flexible schema is useful for unstructured data, but the meeting data here is well-structured and relational

**Trade-offs:**
- SQLite doesn't support all Prisma features (e.g., case-insensitive string filtering with `mode: "insensitive"` isn't supported, so we use plain `contains` instead)
- Not suitable for multi-process or horizontally scaled deployments — would need to migrate to PostgreSQL for production at scale

---

## 2. Authentication: JWT

**Choice:** JSON Web Tokens with bcryptjs for password hashing

**Why:**
JWT is stateless — the server doesn't need to store session data. This makes it simple to implement and easy to scale. Tokens carry the user payload (userId, email) and expire after 7 days, which is a reasonable balance between convenience and security.

**Alternatives considered:**
- Session-based auth — requires server-side session storage (Redis or DB), more infrastructure
- OAuth/Passport.js — overkill for this scope, adds complexity without meaningful benefit here

**Trade-offs:**
- JWTs can't be invalidated before expiry without a blocklist. For this project that's acceptable — in production, a token blocklist or short expiry + refresh token pattern would be better.

---

## 3. AI Provider: Groq

**Choice:** Groq with `llama-3.3-70b-versatile`

**Why:**
Groq offers extremely fast inference on open-source models via a simple API. The free tier is generous enough to run this project without a credit card. The llama-3.3-70b model is capable enough to produce high-quality structured JSON from meeting transcripts.

**Alternatives considered:**
- OpenAI GPT-4 — excellent quality but costs money and has rate limits
- Google Gemini — good option, free tier available, but Groq is faster for inference
- Anthropic Claude — strong reasoning, but more expensive and no generous free tier

**Trade-offs:**
- Groq occasionally deprecates models (e.g., `llama3-70b-8192` was decommissioned during development — switched to `llama-3.3-70b-versatile`)
- Output quality depends on the model — if Groq changes the model again, the prompt may need minor adjustments

---

## 4. External Integration: Resend (Email)

**Choice:** Resend for transactional email

**Why:**
Resend has a clean REST API, a well-maintained Node.js SDK, and a free tier that covers 3,000 emails/month. It integrates in minutes and works perfectly for the reminder workflow — sending an email to the assignee when their action item is overdue.

**Alternatives considered:**
- Slack Webhook — useful for team notifications, but not everyone uses Slack
- SendGrid — more features but heavier SDK and more configuration
- Nodemailer — works but requires SMTP credentials and more setup

**Trade-offs:**
- Resend requires a verified domain for production sending. For testing, the `onboarding@resend.dev` sender works without domain verification.
- Email assumes `assignee` is a valid email address — which is enforced by the action item validation.

---

## 5. Scheduler: node-cron

**Choice:** node-cron running in-process

**Why:**
Simple to set up, no external dependencies, runs inside the same Node.js process. For a service this size it's entirely appropriate.

**Alternatives considered:**
- BullMQ / Bull — powerful job queue with Redis backend, but Redis is additional infrastructure
- Agenda — MongoDB-backed job scheduler, adds a database dependency
- External cron (e.g., platform-level cron on Render) — works but couples deployment platform to app logic

**Trade-offs:**
- In-process cron doesn't survive if the process crashes and restarts mid-job. For production, a queue-based system like BullMQ would be more reliable.
- Only one instance should run the cron job — in a multi-instance deployment this would cause duplicate reminders without a distributed lock.

---

## 6. Validation: Zod

**Choice:** Zod for request body validation

**Why:**
Zod has an excellent TypeScript-friendly API that works just as well in plain JavaScript. Schema definitions are readable, errors are descriptive, and it handles nested objects and arrays cleanly — which matters for validating transcript arrays and citations.

**Alternatives considered:**
- Joi — mature and well-known, but more verbose
- express-validator — works but chains are harder to read than Zod schemas
- Manual validation — error-prone and tedious

---

## 7. Project Structure

```
src/
  routes/       — Express route handlers (one file per resource)
  middleware/   — Auth, validation, traceId, error handling
  services/     — Business logic (AI, email)
  jobs/         — Scheduled background jobs
  utils/        — Logger, response helpers
  swagger/      — OpenAPI config
```

**Why this structure:**
Each layer has a single responsibility. Routes handle HTTP concerns, services handle business logic, middleware handles cross-cutting concerns. This makes the codebase easy to navigate and extend.
