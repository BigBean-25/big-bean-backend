const express = require('express');
const router = express.Router();
const {
  getAllPermissions,
  getGroupedPermissions,
  getMe
} = require('../controllers/adminPermissionController');
const { verifyAdminToken } = require('../middleware/authMiddleware');

// All routes require admin authentication
router.use(verifyAdminToken);

// GET all permissions
router.get('/', getAllPermissions);

// GET grouped permissions
router.get('/grouped', getGroupedPermissions);

// GET current admin user info with permissions
router.get('/me', getMe);

module.exports = router;
