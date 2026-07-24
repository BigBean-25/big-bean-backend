const express = require('express');
const router = express.Router();
const {
  getNotificationsList,
  getUnread,
  getRecent,
  getStats,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler
} = require('../controllers/adminNotificationController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Apply admin auth to all routes — Super Admin bypasses requirePermission automatically
router.use(verifyAdminToken);
router.use(requirePermission('notifications', 'view'));

// Specific (non-parameterized) routes FIRST
// POST /api/admin-notifications/test - Create a sample notification (dev only)
router.post('/test', async (req, res) => {
  try {
    const { createAdminNotification } = require('../services/adminNotificationService');
    await createAdminNotification({
      type: req.body.type || 'franchise_enquiry',
      title: req.body.title || 'Test Franchise Enquiry',
      message: req.body.message || 'This is a test notification',
      module_name: req.body.module_name || 'franchise_enquiries',
      record_id: req.body.record_id || 1,
      action_url: req.body.action_url || '/admin/franchise-enquiries/1',
      priority: req.body.priority || 'high',
      created_by_type: 'system',
      created_by_id: null,
      metadata: req.body.metadata || { test: true }
    });
    res.json({ success: true, message: 'Test notification created' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/admin-notifications/unread-count - Get unread count
router.get('/unread-count', getUnread);

// GET /api/admin-notifications/recent - Get recent notifications (for dropdown)
router.get('/recent', getRecent);

// GET /api/admin-notifications/stats - Get notification stats
router.get('/stats', getStats);

// PUT /api/admin-notifications/mark-all-read - Mark all notifications as read
router.put('/mark-all-read', markAllAsReadHandler);

// GET /api/admin-notifications - Get all notifications with pagination and filters
router.get('/', getNotificationsList);

// Parameterized routes AFTER specific routes
// PUT /api/admin-notifications/:id/read - Mark notification as read
router.put('/:id/read', markAsReadHandler);

// DELETE /api/admin-notifications/:id - Delete notification
router.delete('/:id', deleteNotificationHandler);

module.exports = router;
