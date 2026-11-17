const express = require('express');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ---------- HEALTH ----------
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'studyswap' });
});

// ---------- LIST SESSIONS ----------
app.get('/sessions', (req, res) => {
  const rows = db.prepare('SELECT * FROM sessions').all();
  const out = rows.map(s => ({
    ...s,
    booked: db.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE sessionId = ? AND status = 'confirmed'"
    ).get(s.id).n,
    placesLeft: s.capacity - db.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE sessionId = ? AND status = 'confirmed'"
    ).get(s.id).n
  }));
  res.json(out);
});

// ---------- ONE SESSION ----------
app.get('/sessions/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'session_not_found', message: 'That session does not exist.' });
  s.bookings = db.prepare('SELECT * FROM bookings WHERE sessionId = ?').all(s.id);
  res.json(s);
});

// ---------- BOOK A PLACE ----------
// The whole booking happens inside ONE transaction (BEGIN IMMEDIATE ... COMMIT).
// That is what stops two people taking the last place at the same time.
// A plain check-then-insert in JavaScript is NOT enough — the brief marks that as wrong.
app.post('/bookings', (req, res) => {
  const { sessionId, alias } = req.body || {};
  if (!sessionId || !alias || String(alias).trim() === '') {
    return res.status(400).json({ error: 'missing_field', message: 'sessionId and alias are required.' });
  }
  try {
    db.exec('BEGIN IMMEDIATE');
    const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    if (!s) throw { status: 404, body: { error: 'session_not_found', message: 'That session does not exist.' } };

    const already = db.prepare(
      "SELECT 1 FROM bookings WHERE sessionId = ? AND alias = ? AND status = 'confirmed'"
    ).get(sessionId, alias);
    if (already) throw { status: 409, body: { error: 'duplicate_booking', message: 'This alias already has a booking for this session.' } };

    const n = db.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE sessionId = ? AND status = 'confirmed'"
    ).get(sessionId).n;
    if (n >= s.capacity) throw { status: 409, body: { error: 'session_full', message: 'This session has no places left.' } };

    const r = db.prepare('INSERT INTO bookings (sessionId, alias) VALUES (?, ?)').run(sessionId, alias);
    db.exec('COMMIT');
    res.status(201).json({ id: r.lastInsertRowid, sessionId, alias, status: 'confirmed' });
  } catch (e) {
    db.exec('ROLLBACK');
    if (e.status) return res.status(e.status).json(e.body);
    res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
  }
});

// ---------- CANCEL A BOOKING (POST, idempotent) ----------
// Cancelling the same booking twice returns the same success — it does not error,
// and it frees the place only once.
app.post('/bookings/:id/cancel', (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'booking_not_found', message: 'That booking does not exist.' });
  if (b.status === 'cancelled') {
    return res.json({ id: b.id, sessionId: b.sessionId, alias: b.alias, status: 'cancelled', message: 'Already cancelled. The place is free.' });
  }
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ id: b.id, sessionId: b.sessionId, alias: b.alias, status: 'cancelled', message: 'Booking cancelled. The place is free again.' });
});

app.listen(3000, () => console.log('StudySwap running on http://localhost:3000'));
