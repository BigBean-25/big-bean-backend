const { executeQuery } = require('../src/config/database');

async function addColumnIfMissing(table, column, definition) {
  try {
    const columns = await executeQuery(`SHOW COLUMNS FROM ${table}`);
    const hasColumn = columns.some(c => c.Field === column);
    if (!hasColumn) {
      await executeQuery(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Added ${column} to ${table}`);
    } else {
      console.log(`${column} already exists in ${table}`);
    }
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.log(`Table ${table} does not exist, skipping ${column}`);
    } else {
      throw err;
    }
  }
}

async function ensureAdminUsersColumns() {
  await addColumnIfMissing('admin_users', 'designation', 'VARCHAR(100) NULL AFTER phone');
  await addColumnIfMissing('admin_users', 'status', "ENUM('active','inactive','blocked') DEFAULT 'active' NOT NULL AFTER designation");
  await addColumnIfMissing('admin_users', 'last_login_at', 'TIMESTAMP NULL AFTER status');
  await addColumnIfMissing('admin_user_permissions', 'data_scope', "ENUM('all','assigned','own') DEFAULT 'assigned' AFTER can_export");
  await addColumnIfMissing('admin_role_permissions', 'data_scope', "ENUM('all','assigned','own') DEFAULT 'assigned' AFTER can_export");
}

ensureAdminUsersColumns()
  .then(() => {
    console.log('Admin user columns OK');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
