const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function runMigration() {
  try {
    const sqlFile = path.join(__dirname, '..', 'src', 'migrations', 'create_cafe_events_tables.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split into statements by semicolon, ignore empty/comment-only statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.split('\n').every(line => line.trim().startsWith('--')));

    console.log(`Running ${statements.length} SQL statements...`);

    for (const statement of statements) {
      const query = statement + ';';
      await pool.query(query);
    }

    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runMigration();
