# Testing

This document covers the test scenarios executed manually, edge cases considered, and known limitations found during testing.

---

## How Testing Was Done

All endpoints were tested manually using Swagger UI (`/api-docs`) and Thunder Client. Each scenario below was executed against the running local server with a real SQLite database.

---

## Scenarios Tested

### Authentication

| Scenario | Expected | Result |
|---|---|---|
| Register with valid email and password | 201, user returned | ✅ Pass |
| Register with duplicate email | 409 CONFLICT | ✅ Pass |
| Register with invalid email format | 400 VALIDATION_ERROR | ✅ Pass |
| Register with password shorter than 6 chars | 400 VALIDATION_ERROR | ✅ Pass |
| Login with correct credentials | 200, JWT token returned | ✅ Pass |
| Login with wrong password | 401 UNAUTHORIZED | ✅ Pass |
| Login with unknown email | 401 UNAUTHORIZED | ✅ Pass |

---

### Meeting Management

| Scenario | Expected | Result |
|---|---|---|
| Create meeting with valid body and auth | 201, meeting + transcript returned | ✅ Pass |
| Create meeting without auth token | 401 UNAUTHORIZED | ✅ Pass |
| Create meeting with missing title | 400 VALIDATION_ERROR | ✅ Pass |
| Create meeting with invalid participant email | 400 VALIDATION_ERROR | ✅ Pass |
| Create meeting with empty transcript array | 201, meeting with no entries | ✅ Pass |
| Get meeting by valid ID | 200, full meeting with transcript | ✅ Pass |
| Get meeting by non-existent ID | 404 NOT_FOUND | ✅ Pass |
| List meetings (default pagination) | 200, paginated list | ✅ Pass |
| List meetings with page and limit params | 200, correct slice returned | ✅ Pass |

---

### AI Analysis

| Scenario | Expected | Result |
|---|---|---|
| Analyze meeting with valid transcript | 200, summary/actionItems/decisions/followUps with citations | ✅ Pass |
| Analyze non-existent meeting | 404 NOT_FOUND | ✅ Pass |
| Re-analyze same meeting | 200, previous analysis overwritten | ✅ Pass |
| Citations reference actual transcript timestamps | Citations match input | ✅ Pass |
| Single-line transcript | 200, mostly empty arrays (correct behavior) | ✅ Pass |

---

### Action Items

| Scenario | Expected | Result |
|---|---|---|
| Create action item with all fields | 201, item returned | ✅ Pass |
| Create action item without optional fields | 201, dueDate/meetingId null | ✅ Pass |
| Create action item with invalid status | 400 VALIDATION_ERROR | ✅ Pass |
| Create action item with non-existent meetingId | 500 (FK constraint) — known issue | ⚠️ See below |
| List action items (no filters) | 200, paginated list | ✅ Pass |
| Filter by status=PENDING | 200, only PENDING items | ✅ Pass |
| Filter by assignee (partial match) | 200, matching items | ✅ Pass |
| Filter by meetingId | 200, items for that meeting | ✅ Pass |
| Update status to IN_PROGRESS | 200, updated item | ✅ Pass |
| Update status to COMPLETED | 200, updated item | ✅ Pass |
| Update status of non-existent item | 404 NOT_FOUND | ✅ Pass |
| Update with invalid status value | 400 VALIDATION_ERROR | ✅ Pass |
| Get overdue items (dueDate in past, not COMPLETED) | 200, list of overdue items | ✅ Pass |
| Get overdue items when none exist | 200, empty array | ✅ Pass |

---

### Reminder Job

| Scenario | Expected | Result |
|---|---|---|
| Job logs on startup | Cron registered message logged | ✅ Pass |
| Resend email called for overdue item | Email sent, ReminderLog created | ✅ Pass (verified via Resend dashboard) |

---

### General / Cross-cutting

| Scenario | Expected | Result |
|---|---|---|
| Every response includes traceId | traceId present in all responses | ✅ Pass |
| x-trace-id header echoed in response | Header present | ✅ Pass |
| Custom x-trace-id header passed in request | Same ID used in response | ✅ Pass |
| GET /health | `{"status":"UP"}` | ✅ Pass |
| GET /api/evaluation | Full evaluation object | ✅ Pass |
| Invalid JSON body | 400 from Express JSON parser | ✅ Pass |
| Route not found | 404 from Express | ✅ Pass |

---

## Edge Cases Considered

- **Re-analysis:** Calling analyze twice on the same meeting uses upsert — it overwrites cleanly without duplicate records.
- **Empty transcript:** The AI handles it gracefully by returning empty arrays for all categories.
- **Overdue with no dueDate:** Items with no dueDate are never returned as overdue — the query explicitly filters for `dueDate is not null`.
- **Duplicate registration:** Returns 409 before attempting to hash the password, keeping it efficient.
- **Expired JWT:** Returns 401 with a clear message. User must log in again.
- **Port already in use:** Node throws `EADDRINUSE` — solved by killing the existing process with `lsof -ti :3000 | xargs kill -9`.

---

## Known Limitations

- **No unit/integration test suite** — all testing was done manually. A proper test suite using Jest + Supertest would catch regressions automatically.
- **Action item with non-existent meetingId** — currently causes a 500 from a Prisma FK constraint violation. Should be caught and returned as a 400 with a clear message.
- **AI JSON parsing** — if the model wraps its response in markdown code fences, `JSON.parse` fails and returns 500. A pre-processing step to strip code fences would make this more resilient.
- **Reminder deduplication** — the hourly job sends a reminder every hour for every overdue item. There's no cooldown or "already reminded today" check, so an item can get many emails. In production, a "last reminded at" field with a cooldown window would fix this.
- **SQLite case sensitivity** — assignee filtering uses `contains` but is case-sensitive on SQLite. Searching for "alice" won't match "Alice". A workaround would be to normalize assignee values to lowercase on creation.
