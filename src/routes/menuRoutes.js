const express = require('express');
const router = express.Router();
const {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemStatus,
  getMenuCategories
} = require('../controllers/menuController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get menu categories
router.get('/categories', getMenuCategories);

// Get all menu items with optional filters
router.get('/', getAllMenuItems);

// Get menu item by ID
router.get('/:id', getMenuItemById);

// Create new menu item
router.post('/', verifyAdminToken, requirePermission('menu_items', 'create'), createMenuItem);

// Update menu item
router.put('/:id', verifyAdminToken, requirePermission('menu_items', 'edit'), updateMenuItem);

// Delete menu item
router.delete('/:id', verifyAdminToken, requirePermission('menu_items', 'delete'), deleteMenuItem);

// Toggle menu item status
router.patch('/:id/status', verifyAdminToken, requirePermission('menu_items', 'edit'), toggleMenuItemStatus);

module.exports = router;
