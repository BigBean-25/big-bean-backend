const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Arul2001',
    database: 'bigbean_cafe'
  });

  const sql = fs.readFileSync('D:\\Big-Bean-cafe\\backend\\migrations\\create_merchandise_reviews_table.sql', 'utf8');
  await connection.execute(sql);
  console.log('✅ merchandise_reviews table created');
  await connection.end();
})().catch(e => console.error('❌ Migration failed:', e.message));
