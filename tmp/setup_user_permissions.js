const { executeQuery } = require('../src/config/database');

async function setup() {
  try {
    // Create admin_user_permissions table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS admin_user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        permission_id INT NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        can_export TINYINT(1) DEFAULT 0,
        data_scope ENUM('all','assigned','own') DEFAULT 'assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_permission (user_id, permission_id),
        CONSTRAINT fk_aup_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
        CONSTRAINT fk_aup_permission FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('admin_user_permissions table created');

    // Add data_scope column if missing
    const tables = [
      'events', 'reservations', 'customer_support_tickets', 'contact_enquiries',
      'corporate_enquiries', 'franchise_enquiries', 'merchandise_orders'
    ];

    // Add data_scope to admin_role_permissions
    try {
      const rolePermCols = await executeQuery(`SHOW COLUMNS FROM admin_role_permissions`);
      if (!rolePermCols.some(c => c.Field === 'data_scope')) {
        await executeQuery(`ALTER TABLE admin_role_permissions ADD COLUMN data_scope ENUM('all','assigned','own') DEFAULT 'assigned'`);
        console.log('Added data_scope to admin_role_permissions');
      }
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') console.log('admin_role_permissions data_scope error:', err.message);
    }

    for (const table of tables) {
      try {
        const columns = await executeQuery(`SHOW COLUMNS FROM ${table}`);
        const hasAssigned = columns.some(c => c.Field === 'assigned_admin_id');
        const hasCreated = columns.some(c => c.Field === 'created_by_admin_id');
        if (!hasAssigned) {
          await executeQuery(`ALTER TABLE ${table} ADD COLUMN assigned_admin_id INT NULL`);
          console.log(`Added assigned_admin_id to ${table}`);
        }
        if (!hasCreated && table !== 'career_applications') {
          await executeQuery(`ALTER TABLE ${table} ADD COLUMN created_by_admin_id INT NULL`);
          console.log(`Added created_by_admin_id to ${table}`);
        }
      } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
          console.log(`Table ${table} does not exist, skipping`);
        } else {
          throw err;
        }
      }
    }

    // Add designation column to admin_users if missing
    const adminUserColumns = await executeQuery(`SHOW COLUMNS FROM admin_users`);
    const hasDesignation = adminUserColumns.some(c => c.Field === 'designation');
    if (!hasDesignation) {
      await executeQuery(`ALTER TABLE admin_users ADD COLUMN designation VARCHAR(255) NULL`);
      console.log('Added designation to admin_users');
    }

    console.log('Setup complete');
    process.exit(0);
  } catch (err) {
    console.error('Setup error:', err);
    process.exit(1);
  }
}

setup();
