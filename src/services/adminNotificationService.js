const { executeQuery } = require('../config/database');

/**
 * Create an admin notification
 * Safely inserts notification without breaking main flow if it fails
 */
const createAdminNotification = async ({
  type,
  title,
  message = null,
  module_name = null,
  record_id = null,
  action_url = null,
  priority = 'normal',
  created_by_type = null,
  created_by_id = null,
  metadata = null
}) => {
  try {
    const query = `
      INSERT INTO admin_notifications (
        type, title, message, module_name, record_id, action_url,
        priority, created_by_type, created_by_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      type,
      title,
      message,
      module_name,
      record_id,
      action_url,
      priority,
      created_by_type,
      created_by_id,
      metadata ? JSON.stringify(metadata) : null
    ];
    await executeQuery(query, params);
  } catch (error) {
    // Never break main flow if notification insert fails
    console.warn('Failed to create admin notification:', error.message);
  }
};

/**
 * Get unread notification count
 */
const getUnreadCount = async () => {
  try {
    const query = 'SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = 0';
    const [row] = await executeQuery(query);
    return row.count;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

/**
 * Get recent notifications
 */
const getRecentNotifications = async (limit = 8) => {
  try {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 8));
    const query = `
      SELECT * FROM admin_notifications
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
    `;
    const notifications = await executeQuery(query);
    // Parse metadata JSON for each notification (MySQL JSON column may already return a parsed object)
    return notifications.map(n => ({
      ...n,
      metadata: n.metadata && typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata
    }));
  } catch (error) {
    console.error('Error getting recent notifications:', error);
    return [];
  }
};

/**
 * Get paginated notifications with filters
 */
const getNotifications = async ({ page = 1, limit = 20, is_read = null, type = null, priority = null }) => {
  try {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM admin_notifications WHERE 1=1';
    const params = [];

    if (is_read !== null) {
      query += ' AND is_read = ?';
      params.push(is_read === 'true' ? 1 : 0);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (priority) {
      query += ' AND priority = ?';
      params.push(priority);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countRow] = await executeQuery(countQuery, params);
    const total = countRow.total;

    // Get paginated results (inline limit/offset because MySQL prepared statements reject LIMIT ?)
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const safeOffset = Math.max(0, Number(offset) || 0);
    query += ` ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
    const notifications = await executeQuery(query, params);

    return {
      notifications: notifications.map(n => ({
        ...n,
        metadata: n.metadata && typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting notifications:', error);
    return {
      notifications: [],
      pagination: { page, limit, total: 0, totalPages: 0 }
    };
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (id) => {
  try {
    const query = `
      UPDATE admin_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await executeQuery(query, [id]);
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async () => {
  try {
    const query = `
      UPDATE admin_notifications
      SET is_read = 1, read_at = CURRENT_TIMESTAMP
      WHERE is_read = 0
    `;
    await executeQuery(query);
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

/**
 * Delete notification
 */
const deleteNotification = async (id) => {
  try {
    const query = 'DELETE FROM admin_notifications WHERE id = ?';
    await executeQuery(query, [id]);
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

/**
 * Get notification stats
 */
const getNotificationStats = async () => {
  try {
    const queries = [
      'SELECT COUNT(*) as `total` FROM admin_notifications',
      'SELECT COUNT(*) as `unread` FROM admin_notifications WHERE is_read = 0',
      "SELECT COUNT(*) as `high_priority` FROM admin_notifications WHERE priority IN ('high', 'urgent')",
      'SELECT COUNT(*) as `today` FROM admin_notifications WHERE DATE(created_at) = CURDATE()'
    ];

    const [total, unread, highPriority, today] = await Promise.all(
      queries.map(q => executeQuery(q))
    );

    return {
      total: total[0].total,
      unread: unread[0].unread,
      high_priority: highPriority[0].high_priority,
      today: today[0].today
    };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return {
      total: 0,
      unread: 0,
      high_priority: 0,
      today: 0
    };
  }
};

module.exports = {
  createAdminNotification,
  getUnreadCount,
  getRecentNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats
};
