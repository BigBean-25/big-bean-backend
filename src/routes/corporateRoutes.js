const express = require('express');
const router = express.Router();
const {
  getAllCorporateOrders,
  getCorporateOrderById,
  createCorporateOrder,
  updateCorporateOrderStatus,
  deleteCorporateOrder,
  getCorporateOrderStats
} = require('../controllers/corporateController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all corporate orders with optional filters
router.get('/', getAllCorporateOrders);

// Get corporate order statistics
router.get('/stats', getCorporateOrderStats);

// Get corporate order by ID
router.get('/:id', getCorporateOrderById);

// Create new corporate order
router.post('/', createCorporateOrder);

// Update corporate order status
router.patch('/:id/status', verifyAdminToken, requirePermission('corporate_enquiries', 'edit'), updateCorporateOrderStatus);

// Delete corporate order
router.delete('/:id', verifyAdminToken, requirePermission('corporate_enquiries', 'delete'), deleteCorporateOrder);

module.exports = router;
