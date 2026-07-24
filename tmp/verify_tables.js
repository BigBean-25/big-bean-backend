const { pool } = require('../src/config/database');

async function verify() {
  try {
    const [tables] = await pool.query("SHOW TABLES LIKE 'cafe_event%'");
    console.log('Tables found:', tables.map(t => Object.values(t)[0]));

    const [columns] = await pool.query('SHOW COLUMNS FROM cafe_event_dates');
    console.log('cafe_event_dates columns:', columns.map(c => c.Field));
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

verify();
