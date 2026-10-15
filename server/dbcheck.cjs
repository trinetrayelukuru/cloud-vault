const { allQuery } = require('./config/database');
(async () => {
  try {
    const cols = await allQuery('PRAGMA table_info(security_events)');
    console.log('COLS:', cols.map(r => r[1]).join(', '));
    const events = await allQuery("SELECT id, user_id, event_type, event_status, ip_address, details, datetime(timestamp) AS ts FROM security_events WHERE event_type = 'download_stepup' ORDER BY id DESC LIMIT 5");
    console.log('EVENTS:', JSON.stringify(events));
  } catch (e) { console.log('ERR', e.message); }
  process.exit(0);
})();
