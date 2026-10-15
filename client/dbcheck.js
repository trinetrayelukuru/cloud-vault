const { getQuery } = require('./config/database');
getQuery('PRAGMA table_info(security_events)', (rows, err) => {
  if (err) { console.log('ERR1', err.message); process.exit(0); }
  console.log('COLS:', rows.map(r => r[1]).join(', '));
  getQuery("SELECT id, user_id, event_type, event_status, ip_address, details, datetime(timestamp) AS ts FROM security_events WHERE event_type = 'download_stepup' ORDER BY id DESC LIMIT 5", (rows2, err2) => {
    if (err2) { console.log('ERR2', err2.message); process.exit(0); }
    console.log('EVENTS:', JSON.stringify(rows2));
    process.exit(0);
  });
});
