const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { executeQuery } = require('../config/database');

// GET /api/admin-auth/me — verify token and return current admin with permissions
router.get('/me', verifyAdminToken, async (req, res) => {
  try {
    const admin = req.user;
    const userId = admin.id;

    const users = await executeQuery(
      `SELECT au.id, au.name, au.email, au.role_id, au.status, au.designation,
              ar.role_key, ar.role_name
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    const user = users[0];
    user.is_super_admin = user.role_key === 'super_admin';

    let permissions = [];
    let menuAccess = {};

    if (user.role_key === 'super_admin') {
      permissions = await executeQuery('SELECT * FROM admin_permissions ORDER BY permission_group, sort_order');
      permissions = permissions.map(p => ({
        ...p,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_export: true,
        data_scope: 'all'
      }));
      permissions.forEach(perm => {
        menuAccess[perm.module_key] = true;
      });
    } else {
      const allPerms = await executeQuery('SELECT * FROM admin_permissions ORDER BY permission_group, sort_order');
      const permMap = {};

      allPerms.forEach(p => {
        permMap[p.permission_key] = {
          ...p,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          can_export: false,
          data_scope: 'assigned'
        };
      });

      // Role permissions (fallback)
      if (user.role_id) {
        const rolePerms = await executeQuery(
          `SELECT ap.*, arp.can_view, arp.can_create, arp.can_edit, arp.can_delete, arp.can_export, arp.data_scope
           FROM admin_role_permissions arp
           JOIN admin_permissions ap ON arp.permission_id = ap.id
           WHERE arp.role_id = ?`,
          [user.role_id]
        );

        rolePerms.forEach(p => {
          permMap[p.permission_key] = {
            ...p,
            can_view: p.can_view === 1,
            can_create: p.can_create === 1,
            can_edit: p.can_edit === 1,
            can_delete: p.can_delete === 1,
            can_export: p.can_export === 1,
            data_scope: p.data_scope || 'assigned'
          };
        });
      }

      // User permissions take precedence
      const userPerms = await executeQuery(
        `SELECT ap.*, aup.can_view, aup.can_create, aup.can_edit, aup.can_delete, aup.can_export, aup.data_scope
         FROM admin_user_permissions aup
         JOIN admin_permissions ap ON aup.permission_id = ap.id
         WHERE aup.user_id = ?`,
        [userId]
      );

      userPerms.forEach(p => {
        permMap[p.permission_key] = {
          ...p,
          can_view: p.can_view === 1,
          can_create: p.can_create === 1,
          can_edit: p.can_edit === 1,
          can_delete: p.can_delete === 1,
          can_export: p.can_export === 1,
          data_scope: p.data_scope || 'assigned'
        };
      });

      permissions = Object.values(permMap);
      permissions.forEach(perm => {
        if (perm.can_view) {
          menuAccess[perm.module_key] = true;
        }
      });
    }

    return res.json({
      success: true,
      user,
      permissions,
      menuAccess
    });

  } catch (error) {
    console.error('Admin auth me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
