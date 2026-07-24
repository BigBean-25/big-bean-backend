const { executeQuery } = require('../config/database');

// ── GET all permissions ───────────────────────────────────────────────────────
const getAllPermissions = async (req, res) => {
  try {
    const permissions = await executeQuery(
      'SELECT * FROM admin_permissions ORDER BY permission_group, sort_order'
    );
    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET permissions grouped by module ───────────────────────────────────────────
const getGroupedPermissions = async (req, res) => {
  try {
    const permissions = await executeQuery(
      'SELECT * FROM admin_permissions ORDER BY permission_group, sort_order'
    );

    const grouped = {};
    permissions.forEach(perm => {
      if (!grouped[perm.permission_group]) {
        grouped[perm.permission_group] = [];
      }
      grouped[perm.permission_group].push(perm);
    });

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Get grouped permissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET current admin user info with permissions ────────────────────────────────
const getMe = async (req, res) => {
  try {
    const admin = req.admin || req.user;
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin authentication required' });
    }

    // Get user details with role
    const users = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.designation,
              ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [admin.id]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    const user = users[0];
    user.is_super_admin = user.role_key === 'super_admin';

    // Get permissions
    let permissions = [];
    let allowedModules = [];

    if (user.role_key === 'super_admin') {
      // Super Admin gets all permissions
      permissions = await executeQuery('SELECT * FROM admin_permissions ORDER BY permission_group, sort_order');
      permissions = permissions.map(p => ({ ...p, can_view: true, can_create: true, can_edit: true, can_delete: true, can_export: true, data_scope: 'all' }));
      const modules = await executeQuery('SELECT DISTINCT module_key FROM admin_permissions');
      allowedModules = modules.map(m => m.module_key);
    } else {
      // Get all permissions as base
      const allPerms = await executeQuery('SELECT * FROM admin_permissions ORDER BY permission_group, sort_order');
      const permMap = {};

      allPerms.forEach(perm => {
        permMap[perm.permission_key] = {
          ...perm,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: false,
          data_scope: 'assigned'
        };
      });

      // Get role permissions (fallback if user permissions missing)
      if (user.role_id) {
        const rolePerms = await executeQuery(
          `SELECT ap.*, arp.can_view, arp.can_create, arp.can_edit, arp.can_delete, arp.can_export
           FROM admin_role_permissions arp
           JOIN admin_permissions ap ON arp.permission_id = ap.id
           WHERE arp.role_id = ?`,
          [user.role_id]
        );
        rolePerms.forEach(perm => {
          permMap[perm.permission_key] = {
            ...perm,
            can_view: perm.can_view === 1,
            can_create: perm.can_create === 1,
            can_edit: perm.can_edit === 1,
            can_delete: perm.can_delete === 1,
            can_export: perm.can_export === 1,
            data_scope: perm.data_scope || 'assigned'
          };
        });
      }

      // Get user-specific permissions (overrides)
      const userPerms = await executeQuery(
        `SELECT ap.*, aup.can_view, aup.can_create, aup.can_edit, aup.can_delete, aup.can_export, aup.data_scope
         FROM admin_user_permissions aup
         JOIN admin_permissions ap ON aup.permission_id = ap.id
         WHERE aup.user_id = ?`,
        [user.id]
      );

      userPerms.forEach(perm => {
        permMap[perm.permission_key] = {
          ...perm,
          can_view: perm.can_view === 1,
          can_create: perm.can_create === 1,
          can_edit: perm.can_edit === 1,
          can_delete: perm.can_delete === 1,
          can_export: perm.can_export === 1,
          data_scope: perm.data_scope || 'assigned'
        };
      });

      permissions = Object.values(permMap);
      allowedModules = [...new Set(permissions.filter(p => p.can_view).map(p => p.module_key))];
    }

    // Build menu access based on view permissions
    const menuAccess = {};
    permissions.forEach(perm => {
      if (perm.can_view) {
        menuAccess[perm.module_key] = true;
      }
    });

    res.json({
      success: true,
      data: {
        user,
        permissions,
        allowed_modules: allowedModules,
        menu_access: menuAccess
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getAllPermissions,
  getGroupedPermissions,
  getMe
};
