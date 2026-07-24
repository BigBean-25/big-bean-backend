require('dotenv').config();
const { executeQuery } = require('../config/database');

const seedEventPermissions = async () => {
  try {
    const modules = [
      {
        module_key: 'events',
        module_name: 'Events',
        group: 'marketing',
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      {
        module_key: 'event_bookings',
        module_name: 'Event Bookings',
        group: 'marketing',
        actions: ['view', 'edit', 'export'],
      },
    ];

    const permissionIds = {};

    for (const mod of modules) {
      for (const action of mod.actions) {
        const permKey = `${mod.module_key}.${action}`;
        const permName = `${mod.module_name} ${action.charAt(0).toUpperCase() + action.slice(1)}`;

        await executeQuery(
          `INSERT IGNORE INTO admin_permissions
            (module_key, module_name, permission_key, permission_name, permission_group, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [mod.module_key, mod.module_name, permKey, permName, mod.group, 0]
        );

        const rows = await executeQuery(
          'SELECT id FROM admin_permissions WHERE permission_key = ?',
          [permKey]
        );
        if (rows.length) permissionIds[permKey] = rows[0].id;
      }
    }

    const superRole = await executeQuery('SELECT id FROM admin_roles WHERE role_key = ?', ['super_admin']);
    if (!superRole.length) {
      console.warn('super_admin role not found, skipping role permission assignment');
    } else {
      const roleId = superRole[0].id;
      for (const permId of Object.values(permissionIds)) {
        await executeQuery(
          `INSERT IGNORE INTO admin_role_permissions
            (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [roleId, permId, 1, 1, 1, 1, 1]
        );
      }
      console.log('✅ Super admin role updated with event permissions');
    }

    console.log('✅ Event permissions seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding event permissions:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedEventPermissions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedEventPermissions };
