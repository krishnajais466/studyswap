const { DatabaseSync } = require('node:sqlite');

// This file creates studyswap.db the first time it runs.
// Bookings live in this file, so they survive a server restart.
const db = new DatabaseSync('studyswap.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start TEXT NOT NULL,
    capacity INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT NOT NULL REFERENCES sessions(id),
    alias TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- One active booking per alias per session.
  -- The WHERE clause means a cancelled booking does not block a new one.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_booking_per_alias
    ON bookings(sessionId, alias) WHERE status = 'confirmed';
`);

// Seed the 3 sessions from sessions.csv, but only if the table is empty.
const count = db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n;
if (count === 0) {
  const insert = db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)');
  insert.run('S1', 'Algebra', 'Mon 16:00', 3);
  insert.run('S2', 'Resume review', 'Tue 17:00', 2);
  insert.run('S3', 'Python', 'Wed 16:00', 4);
}

module.exports = db;
