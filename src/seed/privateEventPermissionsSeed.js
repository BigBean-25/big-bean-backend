require('dotenv').config();
const { executeQuery } = require('../config/database');

const seedPrivateEventPermissions = async () => {
  try {
    const modules = [
      {
        module_key: 'private_events',
        module_name: 'Private Events Page',
        group: 'website_content',
        actions: ['view', 'create', 'edit', 'delete', 'export'],
      },
      {
        module_key: 'private_event_enquiries',
        module_name: 'Private Event Enquiries',
        group: 'enquiries',
        actions: ['view', 'create', 'edit', 'delete', 'export'],
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
      console.log('✅ Super admin role updated with private events permissions');
    }

    console.log('✅ Private events permissions seeded successfully');
  } catch (error) {
    console.error('❌ Private events permission seed failed:', error);
  }
  process.exit(0);
};

seedPrivateEventPermissions();
