const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Admin login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find admin user by email in admin_users table
    const users = await executeQuery(
      `SELECT au.*, ar.role_key, ar.role_name FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.email = ?`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your admin account is inactive. Please contact Super Admin.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await executeQuery('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Get user permissions
    let permissions = [];
    let allowedModules = [];
    let menuAccess = {};

    if (user.role_key === 'super_admin') {
      // Super Admin gets all permissions
      permissions = await executeQuery('SELECT * FROM admin_permissions ORDER BY permission_group, sort_order');
      const modules = await executeQuery('SELECT DISTINCT module_key FROM admin_permissions');
      allowedModules = modules.map(m => m.module_key);
      permissions.forEach(perm => {
        const [module] = perm.permission_key.split('.');
        menuAccess[module] = true;
      });
    } else if (user.role_id) {
      // Get role permissions
      const rolePerms = await executeQuery(
        `SELECT ap.* FROM admin_role_permissions arp
         JOIN admin_permissions ap ON arp.permission_id = ap.id
         WHERE arp.role_id = ?`,
        [user.role_id]
      );

      // Get user-specific permissions (overrides)
      const userPerms = await executeQuery(
        `SELECT ap.*, aup.can_view, aup.can_create, aup.can_edit, aup.can_delete, aup.can_export
         FROM admin_user_permissions aup
         JOIN admin_permissions ap ON aup.permission_id = ap.id
         WHERE aup.user_id = ?`,
        [user.id]
      );

      // Merge permissions (user overrides take precedence)
      const permMap = {};
      
      rolePerms.forEach(perm => {
        permMap[perm.permission_key] = {
          ...perm,
          can_view: perm.can_view === 1,
          can_create: perm.can_create === 1,
          can_edit: perm.can_edit === 1,
          can_delete: perm.can_delete === 1,
          can_export: perm.can_export === 1
        };
      });

      userPerms.forEach(perm => {
        if (permMap[perm.permission_key]) {
          if (perm.can_view !== null) permMap[perm.permission_key].can_view = perm.can_view === 1;
          if (perm.can_create !== null) permMap[perm.permission_key].can_create = perm.can_create === 1;
          if (perm.can_edit !== null) permMap[perm.permission_key].can_edit = perm.can_edit === 1;
          if (perm.can_delete !== null) permMap[perm.permission_key].can_delete = perm.can_delete === 1;
          if (perm.can_export !== null) permMap[perm.permission_key].can_export = perm.can_export === 1;
        }
      });

      permissions = Object.values(permMap);
      allowedModules = [...new Set(permissions.map(p => p.module_key))];
      permissions.forEach(perm => {
        if (perm.can_view) {
          const [module] = perm.permission_key.split('.');
          menuAccess[module] = true;
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        type: 'admin',
        role_id: user.role_id,
        role_key: user.role_key
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userWithoutPassword.id,
        name: userWithoutPassword.name,
        email: userWithoutPassword.email,
        role_id: userWithoutPassword.role_id,
        role_key: userWithoutPassword.role_key,
        role_name: userWithoutPassword.role_name,
        status: userWithoutPassword.status,
        is_super_admin: userWithoutPassword.role_key === 'super_admin'
      },
      permissions,
      menuAccess
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const users = await executeQuery(
      'SELECT id, username, email, role, status, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Check if username is already taken by another user
    const existingUsers = await executeQuery(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already taken'
      });
    }

    await executeQuery(
      'UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?',
      [username, userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Get current user
    const users = await executeQuery(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await executeQuery(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  login,
  getProfile,
  updateProfile,
  changePassword
};
