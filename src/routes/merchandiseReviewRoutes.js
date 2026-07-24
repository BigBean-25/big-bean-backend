const express = require('express');
const router = express.Router();
const {
  getProductReviews,
  submitProductReview,
  getAllReviews,
  updateReviewStatus,
  deleteReview
} = require('../controllers/merchandiseReviewController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Public routes
router.get('/product/:merchandiseId', getProductReviews);
router.post('/product/:merchandiseId', submitProductReview);

// Admin routes
router.get('/admin', verifyAdminToken, requirePermission('merchandise_reviews', 'view'), getAllReviews);
router.put('/admin/:id/status', verifyAdminToken, requirePermission('merchandise_reviews', 'edit'), updateReviewStatus);
router.delete('/admin/:id', verifyAdminToken, requirePermission('merchandise_reviews', 'delete'), deleteReview);

module.exports = router;
