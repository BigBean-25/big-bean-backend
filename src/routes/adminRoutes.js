const express = require('express');
const router = express.Router();
const {
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminUserStatus,
  updateAdminUserPassword
} = require('../controllers/adminController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// NOTE: GET /users and GET /users/:id were removed — they used stale SQL (columns `role`
// and `last_login` no longer exist) and returned 500. The canonical admin user API is
// /api/admin-users (adminUserRoutes.js). No frontend code referenced these legacy routes.

// Create new admin user
router.post('/users', verifyAdminToken, requirePermission('admin_users', 'create'), createAdminUser);

// Update admin user
router.put('/users/:id', verifyAdminToken, requirePermission('admin_users', 'edit'), updateAdminUser);

// Update admin user password
router.put('/users/:id/password', verifyAdminToken, requirePermission('admin_users', 'edit'), updateAdminUserPassword);

// Toggle admin user status
router.patch('/users/:id/status', verifyAdminToken, requirePermission('admin_users', 'edit'), toggleAdminUserStatus);

// Delete admin user
router.delete('/users/:id', verifyAdminToken, requirePermission('admin_users', 'delete'), deleteAdminUser);

module.exports = router;
