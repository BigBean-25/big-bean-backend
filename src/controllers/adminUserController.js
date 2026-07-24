const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');

// Helper: determine if a user is super admin
const isSuperAdmin = (user) => user?.role_key === 'super_admin' || user?.is_super_admin === true;

// Helper: count current super admin users
const getSuperAdminCount = async () => {
  const result = await executeQuery(
    `SELECT COUNT(*) AS count
     FROM admin_users au
     JOIN admin_roles ar ON ar.id = au.role_id
     WHERE ar.role_key = 'super_admin' AND au.status != 'deleted'`
  );
  return result[0]?.count || 0;
};

// Helper: save user permissions
const saveUserPermissions = async (userId, permissions) => {
  if (!Array.isArray(permissions)) return;
  for (const perm of permissions) {
    const {
      permission_id,
      can_view = 0,
      can_create = 0,
      can_edit = 0,
      can_delete = 0,
      can_export = 0,
      data_scope = 'assigned'
    } = perm;

    await executeQuery(
      `INSERT INTO admin_user_permissions
        (user_id, permission_id, can_view, can_create, can_edit, can_delete, can_export, data_scope)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        can_view = VALUES(can_view),
        can_create = VALUES(can_create),
        can_edit = VALUES(can_edit),
        can_delete = VALUES(can_delete),
        can_export = VALUES(can_export),
        data_scope = VALUES(data_scope)`,
      [userId, permission_id, can_view ? 1 : 0, can_create ? 1 : 0, can_edit ? 1 : 0, can_delete ? 1 : 0, can_export ? 1 : 0, data_scope]
    );
  }
};

// Helper: get user permissions
const getUserPermissions = async (userId) => {
  return await executeQuery(
    `SELECT ap.id, ap.module_key, ap.module_name, ap.permission_key, ap.permission_name, ap.permission_group,
            aup.can_view, aup.can_create, aup.can_edit, aup.can_delete, aup.can_export, aup.data_scope
     FROM admin_user_permissions aup
     JOIN admin_permissions ap ON aup.permission_id = ap.id
     WHERE aup.user_id = ?`,
    [userId]
  );
};

// ── GET all admin users ─────────────────────────────────────────────────────
const getAllAdminUsers = async (req, res) => {
  try {
    const { search, status, role } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      const q = `%${search}%`;
      conditions.push('(au.name LIKE ? OR au.email LIKE ? OR au.phone LIKE ?)');
      params.push(q, q, q);
    }

    if (status) {
      conditions.push('au.status = ?');
      params.push(status);
    }

    if (role) {
      conditions.push('(ar.role_key = ? OR ar.id = ?)');
      params.push(role, role);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const users = await executeQuery(
      `SELECT
         au.id,
         au.name,
         au.email,
         au.phone,
         au.designation,
         au.status,
         au.role_id,
         ar.role_name,
         ar.role_key,
         au.last_login_at,
         au.created_at,
         COALESCE(pc.permission_count, 0) AS permission_count
       FROM admin_users au
       LEFT JOIN admin_roles ar ON ar.id = au.role_id
       LEFT JOIN (
         SELECT
           user_id,
           COUNT(*) AS permission_count
         FROM admin_user_permissions
         WHERE
           can_view = 1
           OR can_create = 1
           OR can_edit = 1
           OR can_delete = 1
           OR can_export = 1
         GROUP BY user_id
       ) pc ON pc.user_id = au.id
       ${where}
       ORDER BY au.created_at DESC`,
      params
    );

    res.json({ success: true, data: users, users });
  } catch (error) {
    console.error('Fetch admin users error:', {
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    });
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Failed to fetch users' });
  }
};

// ── GET admin user by ID ─────────────────────────────────────────────────────
const getAdminUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const users = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.last_login_at, au.created_at, au.created_by,
              au.designation, ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [id]
    );
    if (!users.length) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const permissions = await getUserPermissions(id);
    res.json({ success: true, data: { user: users[0], permissions } });
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

// ── POST create admin user ────────────────────────────────────────────────────
const createAdminUser = async (req, res) => {
  try {
    const { name, email, phone, password, confirm_password, status, designation, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });
    }

    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    // Check if email already exists
    const existing = await executeQuery('SELECT id FROM admin_users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await executeQuery(
      `INSERT INTO admin_users (name, email, phone, password, status, designation, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim(), phone || null, hashedPassword, status || 'active', designation || null, req.admin?.id || null]
    );

    const userId = result.insertId;

    if (permissions && permissions.length) {
      await saveUserPermissions(userId, permissions);
    }

    res.status(201).json({ success: true, message: 'Admin user created successfully', data: { id: userId } });
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update admin user ─────────────────────────────────────────────────────
const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, status, designation, permissions } = req.body;

    const existing = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.last_login_at, au.created_at, au.created_by,
              au.designation, ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Admin user not found' });

    const user = existing[0];

    // Prevent non-super admin from editing Super Admin
    if (isSuperAdmin(user) && !isSuperAdmin(req.admin)) {
      return res.status(403).json({ success: false, message: 'Cannot edit Super Admin' });
    }

    // Check email uniqueness if changed
    if (email && email !== user.email) {
      const emailCheck = await executeQuery('SELECT id FROM admin_users WHERE email = ? AND id != ?', [email, id]);
      if (emailCheck.length) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
    }

    let passwordUpdate = '';
    let passwordValues = [];
    if (password && password.trim()) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      passwordUpdate = ', password = ?';
      passwordValues = [hashedPassword];
    }

    await executeQuery(
      `UPDATE admin_users SET name = ?, email = ?, phone = ?, status = ?, designation = ?, updated_at = NOW()${passwordUpdate} WHERE id = ?`,
      [name.trim(), email.trim(), phone || null, status || user.status, designation || null, ...passwordValues, id]
    );

    if (permissions && permissions.length) {
      await saveUserPermissions(id, permissions);
    }

    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    console.error('Update admin user error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update admin user password ──────────────────────────────────────────────
const updateAdminUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const existing = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.last_login_at, au.created_at, au.created_by,
              au.designation, ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Admin user not found' });

    // Prevent non-super admin from changing Super Admin password
    if (isSuperAdmin(existing[0]) && !isSuperAdmin(req.admin)) {
      return res.status(403).json({ success: false, message: 'Cannot change Super Admin password' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await executeQuery(
      'UPDATE admin_users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update admin user status ───────────────────────────────────────────────
const updateAdminUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid status (active/inactive/blocked) is required' });
    }

    const existing = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.last_login_at, au.created_at, au.created_by,
              au.designation, ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Admin user not found' });

    // Prevent deactivating self
    if (existing[0].id === req.admin?.id && status !== 'active') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
    }

    // Prevent non-super admin from deactivating Super Admin
    if (isSuperAdmin(existing[0]) && !isSuperAdmin(req.admin)) {
      return res.status(403).json({ success: false, message: 'Cannot change Super Admin status' });
    }

    // Prevent deactivating the last active super admin
    if (isSuperAdmin(existing[0]) && status !== 'active') {
      const superAdminCount = await getSuperAdminCount();
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot deactivate the last Super Admin' });
      }
    }

    await executeQuery(
      'UPDATE admin_users SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

// ── DELETE admin user ─────────────────────────────────────────────────────────
const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery(
      `SELECT au.id, au.name, au.email, au.phone, au.role_id, au.status, au.last_login_at, au.created_at, au.created_by,
              au.designation, ar.role_name, ar.role_key
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [id]
    );
    if (!existing.length) return res.status(404).json({ success: false, message: 'Admin user not found' });

    // Prevent deleting self
    if (existing[0].id === req.admin?.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    // Prevent deleting Super Admin
    if (isSuperAdmin(existing[0])) {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Admin' });
    }

    // Prevent deleting the last active super admin
    if (isSuperAdmin(existing[0])) {
      const superAdminCount = await getSuperAdminCount();
      if (superAdminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last Super Admin' });
      }
    }

    await executeQuery('DELETE FROM admin_users WHERE id = ?', [id]);

    res.json({ success: true, message: 'Admin user deleted successfully' });
  } catch (error) {
    console.error('Delete admin user error:', error);
    res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

module.exports = {
  getAllAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  updateAdminUserPassword,
  updateAdminUserStatus,
  deleteAdminUser
};
