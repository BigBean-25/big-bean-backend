const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Arul2001',
    database: 'bigbean_cafe'
  });

  console.log('--- Current super admin info ---');
  const [rows] = await conn.execute(`
    SELECT au.id, au.name, au.email, au.status, ar.role_name, ar.role_key
    FROM admin_users au
    LEFT JOIN admin_roles ar ON au.role_id = ar.id
    WHERE au.email = 'admin@bigbeancafe.in'
  `);
  console.log(rows[0] || 'not found');

  if (!rows[0] || rows[0].role_key !== 'super_admin') {
    console.log('--- Fixing super admin role ---');
    await conn.execute(`
      INSERT INTO admin_roles (role_name, role_key, description, is_system, is_active)
      SELECT 'Super Admin', 'super_admin', 'Full access', 1, 1
      WHERE NOT EXISTS (
        SELECT 1 FROM admin_roles WHERE role_key = 'super_admin'
      )
    `);

    await conn.execute(`
      UPDATE admin_users au
      JOIN admin_roles ar ON ar.role_key = 'super_admin'
      SET au.role_id = ar.id, au.status = 'active'
      WHERE au.email = 'admin@bigbeancafe.in'
    `);

    const [rows2] = await conn.execute(`
      SELECT au.id, au.name, au.email, au.status, ar.role_name, ar.role_key
      FROM admin_users au
      LEFT JOIN admin_roles ar ON au.role_id = ar.id
      WHERE au.email = 'admin@bigbeancafe.in'
    `);
    console.log('--- After fix ---');
    console.log(rows2[0]);
  }

  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
