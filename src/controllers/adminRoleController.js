const { executeQuery } = require('../config/database');

// ── GET all roles ───────────────────────────────────────────────────────────────
const getAllRoles = async (req, res) => {
  try {
    const roles = await executeQuery(
      `SELECT ar.*, 
              (SELECT COUNT(*) FROM admin_users WHERE role_id = ar.id) as user_count
       FROM admin_roles ar
       ORDER BY ar.is_system DESC, ar.role_name ASC`
    );
    res.json({ success: true, data: roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET role by ID ────────────────────────────────────────────────────────────
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const roles = await executeQuery('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!roles.length) return res.status(404).json({ success: false, message: 'Role not found' });
    res.json({ success: true, data: roles[0] });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET role permissions ────────────────────────────────────────────────────────
const getRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [role] = await executeQuery('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!role.length) return res.status(404).json({ success: false, message: 'Role not found' });

    const permissions = await executeQuery(
      `SELECT arp.*, ap.module_key, ap.module_name, ap.permission_key, ap.permission_name, ap.permission_group
       FROM admin_role_permissions arp
       JOIN admin_permissions ap ON arp.permission_id = ap.id
       WHERE arp.role_id = ?
       ORDER BY ap.permission_group, ap.sort_order`,
      [id]
    );

    res.json({ success: true, data: permissions });
  } catch (error) {
    console.error('Get role permissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST create role ───────────────────────────────────────────────────────────
const createRole = async (req, res) => {
  try {
    const { role_name, role_key, description, is_active } = req.body;

    if (!role_name || !role_key) {
      return res.status(400).json({ success: false, message: 'role_name and role_key are required' });
    }

    // Check if role_key already exists
    const [existing] = await executeQuery('SELECT id FROM admin_roles WHERE role_key = ?', [role_key]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Role key already exists' });
    }

    const result = await executeQuery(
      `INSERT INTO admin_roles (role_name, role_key, description, is_active)
       VALUES (?, ?, ?, ?)`,
      [role_name.trim(), role_key.trim().toLowerCase().replace(/\s+/g, '_'), description || null, is_active !== undefined ? is_active : 1]
    );

    res.status(201).json({ success: true, message: 'Role created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update role ───────────────────────────────────────────────────────────
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, description, is_active } = req.body;

    const [existing] = await executeQuery('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Role not found' });

    // Prevent modifying system roles
    if (existing[0].is_system === 1) {
      return res.status(403).json({ success: false, message: 'Cannot modify system roles' });
    }

    await executeQuery(
      `UPDATE admin_roles SET role_name = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?`,
      [role_name.trim(), description || null, is_active !== undefined ? is_active : existing[0].is_active, id]
    );

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update role permissions ─────────────────────────────────────────────────
const updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'permissions must be an array' });
    }

    const [role] = await executeQuery('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!role.length) return res.status(404).json({ success: false, message: 'Role not found' });

    // Prevent modifying Super Admin permissions
    if (role[0].role_key === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Admin permissions' });
    }

    // Delete existing role permissions
    await executeQuery('DELETE FROM admin_role_permissions WHERE role_id = ?', [id]);

    // Insert new permissions
    for (const perm of permissions) {
      if (!perm.permission_id) continue;

      await executeQuery(
        `INSERT INTO admin_role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export, data_scope)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          perm.permission_id,
          perm.can_view ? 1 : 0,
          perm.can_create ? 1 : 0,
          perm.can_edit ? 1 : 0,
          perm.can_delete ? 1 : 0,
          perm.can_export ? 1 : 0,
          perm.data_scope || 'assigned'
        ]
      );
    }

    res.json({ success: true, message: 'Role permissions updated successfully' });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── DELETE role ───────────────────────────────────────────────────────────────
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await executeQuery('SELECT * FROM admin_roles WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Role not found' });

    // Prevent deleting system roles
    if (existing[0].is_system === 1) {
      return res.status(403).json({ success: false, message: 'Cannot delete system roles' });
    }

    // Check if role is assigned to any users
    const [userCount] = await executeQuery('SELECT COUNT(*) as count FROM admin_users WHERE role_id = ?', [id]);
    if (userCount[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete role that is assigned to users' });
    }

    await executeQuery('DELETE FROM admin_roles WHERE id = ?', [id]);

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  getRolePermissions,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole
};
