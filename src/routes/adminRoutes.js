const express = require('express');
const router = express.Router();
const {
  getAllAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminUserStatus,
  updateAdminUserPassword
} = require('../controllers/adminController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all admin users with optional filters
router.get('/users', getAllAdminUsers);

// Get admin user by ID
router.get('/users/:id', getAdminUserById);

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
