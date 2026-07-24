const express = require('express');
const router = express.Router();
const {
  getAllAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  updateAdminUserPassword,
  updateAdminUserStatus,
  deleteAdminUser
} = require('../controllers/adminUserController');
const { verifyAdminToken, requireSuperAdmin, requirePermission } = require('../middleware/authMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// GET all users - require admin_users.view or Super Admin
router.get('/', requirePermission('admin_users', 'view'), getAllAdminUsers);

// GET user by ID - require admin_users.view or Super Admin
router.get('/:id', requirePermission('admin_users', 'view'), getAdminUserById);

// POST create user - require admin_users.create or Super Admin
router.post('/', requirePermission('admin_users', 'create'), createAdminUser);

// PUT update user - require admin_users.edit or Super Admin
router.put('/:id', requirePermission('admin_users', 'edit'), updateAdminUser);

// PUT update user password - require admin_users.edit or Super Admin
router.put('/:id/password', requirePermission('admin_users', 'edit'), updateAdminUserPassword);

// PUT update user status - require admin_users.edit or Super Admin
router.put('/:id/status', requirePermission('admin_users', 'edit'), updateAdminUserStatus);

// DELETE user - require admin_users.delete or Super Admin
router.delete('/:id', requirePermission('admin_users', 'delete'), deleteAdminUser);

module.exports = router;
