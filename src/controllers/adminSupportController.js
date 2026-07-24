const { pool } = require('../config/database');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const safeQ = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const VALID_STATUSES = ['open','in_progress','waiting_customer','resolved','closed'];
const VALID_PRIORITIES = ['low','medium','high','urgent'];

// GET /api/admin-support/tickets
exports.getTickets = async (req, res) => {
  try {
    const { status, priority, search, page = 1, limit = 50 } = req.query;
    let where = '1=1';
    const params = [];

    if (status && VALID_STATUSES.includes(status)) {
      where += ' AND t.status = ?'; params.push(status);
    }
    if (priority && VALID_PRIORITIES.includes(priority)) {
      where += ' AND t.priority = ?'; params.push(priority);
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      where += ' AND (t.ticket_number LIKE ? OR t.subject LIKE ? OR t.customer_name LIKE ? OR t.customer_email LIKE ?)';
      params.push(q, q, q, q);
    }

    const scope = await getDataScopeFilter(req.admin || req.user, 'support_tickets', 't');
    if (scope.clause) {
      where += ' AND ' + scope.clause;
      params.push(...scope.params);
    }

    const rows = await safeQ(
      `SELECT t.*,
        (SELECT COUNT(*) FROM customer_support_messages WHERE ticket_id = t.id) AS message_count,
        (SELECT message FROM customer_support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT sender_type FROM customer_support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_sender_type,
        (SELECT created_at FROM customer_support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message_at
       FROM customer_support_tickets t
       WHERE ${where}
       ORDER BY t.updated_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${(parseInt(page) - 1) * parseInt(limit)}`,
      params
    );

    // Stats
    const [stats] = await safeQ(`
      SELECT
        COUNT(*) AS total,
        SUM(status='open') AS open_count,
        SUM(status='in_progress') AS in_progress_count,
        SUM(status='waiting_customer') AS waiting_count,
        SUM(status='resolved') AS resolved_count,
        SUM(status='closed') AS closed_count
      FROM customer_support_tickets
    `);

    return res.json({ success: true, data: rows, stats });
  } catch (err) {
    console.error('admin getTickets error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/admin-support/tickets/:id
exports.getTicketById = async (req, res) => {
  try {
    const rows = await safeQ('SELECT * FROM customer_support_tickets WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const messages = await safeQ(
      'SELECT * FROM customer_support_messages WHERE ticket_id=? ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ success: true, data: { ...rows[0], messages } });
  } catch (err) {
    console.error('admin getTicketById error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/admin-support/tickets/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}` });
    }
    const rows = await safeQ('SELECT * FROM customer_support_tickets WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    await pool.execute('UPDATE customer_support_tickets SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);
    // System message
    await pool.execute(
      'INSERT INTO customer_support_messages (ticket_id, sender_type, sender_name, message) VALUES (?,?,?,?)',
      [req.params.id, 'system', 'System', `Status updated to: ${status}`]
    );
    return res.json({ success: true, message: 'Status updated', status });
  } catch (err) {
    console.error('updateStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/admin-support/tickets/:id/reply
exports.reply = async (req, res) => {
  try {
    const { message, status } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    const rows = await safeQ('SELECT * FROM customer_support_tickets WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const adminId = req.user?.id || null;
    const adminName = req.user?.username || req.user?.name || 'Big Bean Café Support';

    await pool.execute(
      'INSERT INTO customer_support_messages (ticket_id, sender_type, sender_id, sender_name, message) VALUES (?,?,?,?,?)',
      [req.params.id, 'admin', adminId, adminName, message.trim()]
    );

    const nextStatus = status && VALID_STATUSES.includes(status) ? status : 'waiting_customer';
    await pool.execute('UPDATE customer_support_tickets SET status=?, updated_at=NOW() WHERE id=?', [nextStatus, req.params.id]);

    const msgs = await safeQ('SELECT * FROM customer_support_messages WHERE ticket_id=? ORDER BY created_at ASC', [req.params.id]);
    return res.status(201).json({ success: true, data: msgs[msgs.length - 1], status: nextStatus });
  } catch (err) {
    console.error('reply error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
