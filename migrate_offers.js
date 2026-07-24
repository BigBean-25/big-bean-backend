const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bigbean_cafe',
  });

  const run = async (sql, label) => {
    try {
      await c.execute(sql);
      console.log(`✅ ${label}`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`⚠️  ${label}: column already exists`);
      } else {
        console.error(`❌ ${label}: ${e.message}`);
      }
    }
  };

  await run(
    'ALTER TABLE offers ADD COLUMN badge_text VARCHAR(50) NULL AFTER discount_text',
    'badge_text'
  );
  await run(
    'ALTER TABLE offers ADD COLUMN label_text VARCHAR(80) NULL AFTER badge_text',
    'label_text'
  );

  await c.end();
  console.log('Migration complete.');
})();
