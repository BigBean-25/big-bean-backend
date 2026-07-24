const {
  getUnreadCount,
  getRecentNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats
} = require('../services/adminNotificationService');

/**
 * Get all notifications with pagination and filters
 */
const getNotificationsList = async (req, res) => {
  try {
    const { page = 1, limit = 20, is_read, type, priority } = req.query;
    const result = await getNotifications({
      page: parseInt(page),
      limit: parseInt(limit),
      is_read,
      type,
      priority
    });
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notifications'
    });
  }
};

/**
 * Get unread count
 */
const getUnread = async (req, res) => {
  try {
    const count = await getUnreadCount();
    res.json({
      success: true,
      unread_count: count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
};

/**
 * Get recent notifications (for dropdown)
 */
const getRecent = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const notifications = await getRecentNotifications(limit);
    const unreadCount = await getUnreadCount();
    res.json({
      success: true,
      notifications,
      unread_count: unreadCount
    });
  } catch (error) {
    console.error('Error getting recent notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recent notifications'
    });
  }
};

/**
 * Get notification stats
 */
const getStats = async (req, res) => {
  try {
    const stats = await getNotificationStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification stats'
    });
  }
};

/**
 * Mark notification as read
 */
const markAsReadHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await markAsRead(id);
    if (success) {
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsReadHandler = async (req, res) => {
  try {
    const success = await markAllAsRead();
    if (success) {
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

/**
 * Delete notification
 */
const deleteNotificationHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const success = await deleteNotification(id);
    if (success) {
      res.json({
        success: true,
        message: 'Notification deleted'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

module.exports = {
  getNotificationsList,
  getUnread,
  getRecent,
  getStats,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler
};
