const express = require('express');
const router = express.Router();
const {
  getAllRoles,
  getRoleById,
  getRolePermissions,
  createRole,
  updateRole,
  updateRolePermissions,
  deleteRole
} = require('../controllers/adminRoleController');
const { verifyAdminToken, requireSuperAdmin } = require('../middleware/authMiddleware');

// All routes require admin authentication and Super Admin
router.use(verifyAdminToken);
router.use(requireSuperAdmin);

// GET all roles
router.get('/', getAllRoles);

// GET role by ID
router.get('/:id', getRoleById);

// GET role permissions
router.get('/:id/permissions', getRolePermissions);

// POST create role
router.post('/', createRole);

// PUT update role
router.put('/:id', updateRole);

// PUT update role permissions
router.put('/:id/permissions', updateRolePermissions);

// DELETE role
router.delete('/:id', deleteRole);

module.exports = router;
