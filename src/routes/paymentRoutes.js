const express = require('express');
const router = express.Router();
const { verifyAdminToken } = require('../middleware/authMiddleware');
const {
  getPublicConfig,
  validateConfig,
  createOrder,
  verifyPayment,
  webhook,
  testOrder,
} = require('../controllers/paymentController');

// Public — no auth
router.get('/public-config', getPublicConfig);
router.get('/validate-config', validateConfig);
router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/webhook', webhook);

// Admin only
router.post('/test-order', verifyAdminToken, testOrder);

module.exports = router;
