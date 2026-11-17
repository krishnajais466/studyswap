# StudySwap — CareerSwami Project 1

Build a session-booking app that must never overbook. 2 weeks, 6–8 hours total.

**Author:** Krishna Jaiswal
**Stack:** Node.js 22+, Express, SQLite (`node:sqlite`, built in — no extra database package)
**Sessions:** S1 Algebra Mon 16:00, capacity 3 · S2 Resume review Tue 17:00, capacity 2 · S3 Python Wed 16:00, capacity 4

## What to open first
1. This README
2. `http://localhost:3000` after starting the server (see below)

## Setup — exact commands
Requires Node.js v22 or newer (`node -v` must show v22+).

```
npm install
node server.js
```
Open `http://localhost:3000` in a browser. You should see the StudySwap page and the 3 sessions.

To start clean again (empty bookings, sessions re-seeded from `sessions.csv`):
```
node reset.js
```

## Entity diagram
```
sessions (1) ────< bookings (many)
  id (PK)          id (PK, auto-increment)
  title            sessionId (FK -> sessions.id)
  start            alias
  capacity         status: confirmed / cancelled
                   createdAt
```

**Where capacity is enforced:** in the database, not in a check-then-insert `if`.
`POST /bookings` runs inside one SQLite transaction (`BEGIN IMMEDIATE` … `COMMIT`):
it counts confirmed bookings for the session and inserts only if `count < capacity`.
A unique index in `db.js` also stops the same alias booking the same session twice while active.
Bookings are stored in `studyswap.db` (SQLite file), so they survive a server restart.

## API contract

| Method | Route | Request | Success | Errors |
|--------|-------|---------|---------|--------|
| GET | `/health` | — | 200 `{"ok": true, "service": "studyswap"}` | — |
| GET | `/sessions` | — | 200 list of sessions, each with `booked` and `placesLeft` | — |
| GET | `/sessions/:id` | — | 200 one session + its bookings | 404 `session_not_found` |
| POST | `/bookings` | `{"sessionId": "S1", "alias": "owl42"}` | 201 `{"id": 1, "sessionId": "S1", "alias": "owl42", "status": "confirmed"}` | 400 `missing_field` (missing/blank sessionId or alias) · 404 `session_not_found` · 409 `duplicate_booking` · 409 `session_full` with body `{"error": "session_full", "message": "This session has no places left."}` |
| POST | `/bookings/:id/cancel` | — | 200 `{"id": 1, "status": "cancelled", ...}` — the place is free again | 404 `booking_not_found` |

**Double-booking rule:** one alias can hold one active booking per session. A second active booking for the same session gets 409 `duplicate_booking`. A cancelled booking does not block a new booking.

## How to test (10 tests — full commands in `evidence-log.csv`)
1. Health: open `/health` → `{"ok": true}`.
2. List: open `/sessions` → S1, S2, S3, all `booked: 0`.
3. Book 3 places on S1 with different aliases → all 201.
4. 4th booking on S1 → **409 `session_full`**, and S1 still shows `booked: 3`.
5. Same alias books S1 again → 409 `duplicate_booking`.
6. Book session `S9` → 404 `session_not_found`.
7. Book with a blank alias → 400 `missing_field`.
8. Cancel booking 1 (`POST /bookings/1/cancel`) → 200, place free; book S1 again → 201.
9. Cancel booking 1 again → still 200 ("Already cancelled"), count does not change.
10. Restart: stop the server (Ctrl+C), run `node server.js` again → bookings are still there.

Example booking command:
```
curl -X POST http://localhost:3000/bookings -H "Content-Type: application/json" -d "{\"sessionId\":\"S1\",\"alias\":\"owl42\"}"
```

## Files
See `file-index.csv` for every file, its purpose, and how to open/run it.

## Known limits
- Local development only. No login, no real user data, no public hosting.
- Concurrency is handled by one SQLite transaction on one server; this is not a production multi-server setup.

## AI assistance disclosure
I used Muse (Meta AI) to build this project with me: it wrote the step-by-step guide, the server and database code, and ran the tests. I checked the results myself — the 409 overbooking test, the cancel/re-book test, and the restart-persistence test — and the evidence in `evidence-log.csv` is from real runs, not invented.
