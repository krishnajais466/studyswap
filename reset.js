// Reset: delete the database file, then re-seed from db.js.
// Usage: node reset.js
const fs = require('fs');
if (fs.existsSync('studyswap.db')) fs.unlinkSync('studyswap.db');
require('./db');
console.log('Reset done. Sessions S1/S2/S3 are seeded again, bookings are empty.');
