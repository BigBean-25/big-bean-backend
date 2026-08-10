require('dotenv').config();
const { executeQuery } = require('../config/database');

const seedAboutFounderPermissions = async () => {
  try {
    const modules = [
      {
        module_key: 'about_founders',
        module_name: 'About Founders',
        group: 'website_content',
        actions: ['view', 'create', 'edit', 'delete'],
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
      console.log('✅ super_admin role updated with about_founders permissions');
    }

    console.log('✅ About Founders permissions seeded successfully');
    console.log('   Permissions registered:');
    Object.keys(permissionIds).forEach(k => console.log(`   - ${k} (id: ${permissionIds[k]})`));
  } catch (error) {
    console.error('❌ Error seeding about_founders permissions:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedAboutFounderPermissions()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedAboutFounderPermissions };
