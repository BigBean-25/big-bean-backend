const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

// Authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = user;
    next();
  });
};

// Verify admin token specifically
const verifyAdminToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Accept tokens with type 'admin' OR tokens that have an id (legacy tokens)
    if (decoded.type && decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Always fetch fresh user + role from DB — do not rely on stale token payload
    const users = await executeQuery(
      `SELECT au.id, au.name, au.email, au.role_id, au.status,
              ar.role_key, ar.role_name
       FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ? OR au.email = ?
       LIMIT 1`,
      [decoded.id, decoded.email]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Admin user not found'
      });
    }

    const user = users[0];
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Your admin account is inactive. Please contact Super Admin.'
      });
    }

    // Attach req.admin with fresh DB data
    req.admin = {
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role_key: user.role_key,
      role_name: user.role_name,
      is_super_admin: user.role_key === 'super_admin'
    };
    // Also keep req.user for backwards compat with older routes
    req.user = req.admin;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Check if user is Super Admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role_key !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access required'
    });
  }

  next();
};

// Check specific permission
const requirePermission = (moduleKey, action) => {
  return async (req, res, next) => {
    const admin = req.admin || req.user;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super Admin bypasses ALL permission checks — always first
    if (admin.is_super_admin || admin.role_key === 'super_admin') {
      return next();
    }

    try {
      const permissionKey = `${moduleKey}.${action}`;

      console.log('RBAC CHECK:', {
        adminId: admin.id,
        email: admin.email,
        roleKey: admin.role_key,
        moduleKey,
        action,
        isSuperAdmin: admin.is_super_admin
      });
      
      // Check role permissions
      const rolePerms = await executeQuery(
        `SELECT arp.* FROM admin_role_permissions arp
         JOIN admin_permissions ap ON arp.permission_id = ap.id
         WHERE arp.role_id = ? AND ap.permission_key = ?`,
        [admin.role_id, permissionKey]
      );

      // Check user-specific permissions (overrides)
      const userPerms = await executeQuery(
        `SELECT aup.* FROM admin_user_permissions aup
         JOIN admin_permissions ap ON aup.permission_id = ap.id
         WHERE aup.user_id = ? AND ap.permission_key = ?`,
        [admin.id, permissionKey]
      );

      let hasPermission = false;

      // Check user override first
      if (userPerms.length > 0) {
        const userPerm = userPerms[0];
        if (action === 'view' && userPerm.can_view === 1) hasPermission = true;
        else if (action === 'create' && userPerm.can_create === 1) hasPermission = true;
        else if (action === 'edit' && userPerm.can_edit === 1) hasPermission = true;
        else if (action === 'delete' && userPerm.can_delete === 1) hasPermission = true;
        else if (action === 'export' && userPerm.can_export === 1) hasPermission = true;
      } else if (rolePerms.length > 0) {
        const rolePerm = rolePerms[0];
        if (action === 'view' && rolePerm.can_view === 1) hasPermission = true;
        else if (action === 'create' && rolePerm.can_create === 1) hasPermission = true;
        else if (action === 'edit' && rolePerm.can_edit === 1) hasPermission = true;
        else if (action === 'delete' && rolePerm.can_delete === 1) hasPermission = true;
        else if (action === 'export' && rolePerm.can_export === 1) hasPermission = true;
      }

      if (!hasPermission) {
        console.warn('RBAC DENIED:', { adminId: admin.id, email: admin.email, roleKey: admin.role_key, moduleKey, action });
        return res.status(403).json({
          success: false,
          message: `You do not have permission to ${action} ${moduleKey}`
        });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

// Check if user has any of the specified permissions
const requireAnyPermission = (permissionKeys) => {
  return async (req, res, next) => {
    const admin = req.admin || req.user;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Super Admin bypasses all permission checks
    if (admin.is_super_admin || admin.role_key === 'super_admin') {
      return next();
    }

    try {
      let hasAnyPermission = false;

      for (const permKey of permissionKeys) {
        const [moduleKey, action] = permKey.split('.');
        
        const rolePerms = await executeQuery(
          `SELECT arp.* FROM admin_role_permissions arp
           JOIN admin_permissions ap ON arp.permission_id = ap.id
           WHERE arp.role_id = ? AND ap.permission_key = ?`,
          [admin.role_id, permKey]
        );

        const userPerms = await executeQuery(
          `SELECT aup.* FROM admin_user_permissions aup
           JOIN admin_permissions ap ON aup.permission_id = ap.id
           WHERE aup.user_id = ? AND ap.permission_key = ?`,
          [admin.id, permKey]
        );

        let hasThisPermission = false;

        if (userPerms.length > 0) {
          const userPerm = userPerms[0];
          if (action === 'view' && userPerm.can_view === 1) hasThisPermission = true;
          else if (action === 'create' && userPerm.can_create === 1) hasThisPermission = true;
          else if (action === 'edit' && userPerm.can_edit === 1) hasThisPermission = true;
          else if (action === 'delete' && userPerm.can_delete === 1) hasThisPermission = true;
          else if (action === 'export' && userPerm.can_export === 1) hasThisPermission = true;
        } else if (rolePerms.length > 0) {
          const rolePerm = rolePerms[0];
          if (action === 'view' && rolePerm.can_view === 1) hasThisPermission = true;
          else if (action === 'create' && rolePerm.can_create === 1) hasThisPermission = true;
          else if (action === 'edit' && rolePerm.can_edit === 1) hasThisPermission = true;
          else if (action === 'delete' && rolePerm.can_delete === 1) hasThisPermission = true;
          else if (action === 'export' && rolePerm.can_export === 1) hasThisPermission = true;
        }

        if (hasThisPermission) {
          hasAnyPermission = true;
          break;
        }
      }

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource'
        });
      }

      next();
    } catch (err) {
      console.error('Permission check error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};

// Get data scope for an admin user for a specific module
const getAdminDataScope = async (adminId, moduleKey) => {
  if (!adminId || !moduleKey) return 'all';

  try {
    const userPerms = await executeQuery(
      `SELECT aup.data_scope FROM admin_user_permissions aup
       JOIN admin_permissions ap ON aup.permission_id = ap.id
       WHERE aup.user_id = ? AND ap.module_key = ? AND aup.can_view = 1
       LIMIT 1`,
      [adminId, moduleKey]
    );

    if (userPerms.length) {
      return userPerms[0].data_scope || 'assigned';
    }

    // Fallback to role permissions
    const admin = await executeQuery(
      `SELECT au.role_id, ar.role_key FROM admin_users au
       LEFT JOIN admin_roles ar ON au.role_id = ar.id
       WHERE au.id = ?`,
      [adminId]
    );

    if (!admin.length || admin[0].role_key === 'super_admin') return 'all';

    const rolePerms = await executeQuery(
      `SELECT arp.data_scope FROM admin_role_permissions arp
       JOIN admin_permissions ap ON arp.permission_id = ap.id
       WHERE arp.role_id = ? AND ap.module_key = ? AND arp.can_view = 1
       LIMIT 1`,
      [admin[0].role_id, moduleKey]
    );

    return rolePerms.length ? rolePerms[0].data_scope || 'assigned' : 'all';
  } catch (err) {
    console.error('getAdminDataScope error:', err);
    return 'all';
  }
};

// Build a data scope WHERE clause and parameters for list queries
const getDataScopeFilter = async (admin, moduleKey, tableAlias = '') => {
  if (!admin || admin.is_super_admin || admin.role_key === 'super_admin') {
    return { clause: '', params: [] };
  }

  const scope = await getAdminDataScope(admin.id, moduleKey);
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const params = [];
  let clause = '';

  if (scope === 'own') {
    clause = `(${prefix}created_by_admin_id = ? OR ${prefix}created_by_admin_id IS NULL)`;
    params.push(admin.id);
  } else if (scope === 'assigned') {
    clause = `(${prefix}assigned_admin_id = ? OR ${prefix}created_by_admin_id = ? OR ${prefix}assigned_admin_id IS NULL)`;
    params.push(admin.id, admin.id);
  }

  return { clause, params, scope };
};

// Check user role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      req.user = null;
    } else {
      req.user = user;
    }
    next();
  });
};

module.exports = {
  authenticateToken,
  verifyAdminToken,
  requireRole,
  requireSuperAdmin,
  requirePermission,
  requireAnyPermission,
  optionalAuth,
  getAdminDataScope,
  getDataScopeFilter
};
