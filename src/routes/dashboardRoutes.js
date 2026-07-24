const express = require('express');
const router = express.Router();
const {
  getDashboardOverview,
  getRecentActivities,
  getAnalytics,
  getSystemAlerts,
  getQuickStats
} = require('../controllers/dashboardController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get dashboard overview statistics
router.get('/overview', getDashboardOverview);

// Get recent activities
router.get('/activities', getRecentActivities);

// Get analytics data
router.get('/analytics', getAnalytics);

// Get system alerts
router.get('/alerts', getSystemAlerts);

// Get quick stats
router.get('/stats', getQuickStats);

module.exports = router;
