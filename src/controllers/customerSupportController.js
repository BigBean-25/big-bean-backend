const { pool } = require('../config/database');
const { createAdminNotification } = require('../services/adminNotificationService');

const makeTicketNumber = () => {
  const d = new Date();
  const dt = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rnd = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `BBCT-${dt}-${rnd}`;
};

const safeQ = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

const VALID_CATEGORIES = ['general','order','payment','delivery','refund','product','technical'];
const VALID_PRIORITIES = ['low','medium','high','urgent'];

// GET /api/customer-support/tickets
exports.getTickets = async (req, res) => {
  try {
    const cid = req.customer.id;
    const rows = await safeQ(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM customer_support_messages WHERE ticket_id = t.id) AS message_count,
        (SELECT message FROM customer_support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT sender_type FROM customer_support_messages WHERE ticket_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_sender_type
       FROM customer_support_tickets t
       WHERE t.customer_id = ?
       ORDER BY t.updated_at DESC`,
      [cid]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getTickets error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/customer-support/tickets/:id
exports.getTicketById = async (req, res) => {
  try {
    const cid = req.customer.id;
    const rows = await safeQ('SELECT * FROM customer_support_tickets WHERE id=? AND customer_id=?', [req.params.id, cid]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const messages = await safeQ(
      'SELECT * FROM customer_support_messages WHERE ticket_id=? ORDER BY created_at ASC',
      [req.params.id]
    );
    return res.json({ success: true, data: { ...rows[0], messages } });
  } catch (err) {
    console.error('getTicketById error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/customer-support/tickets
exports.createTicket = async (req, res) => {
  try {
    const cid = req.customer.id;
    const { subject, message, category, priority } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required' });
    const cat = VALID_CATEGORIES.includes(category) ? category : 'general';
    const pri = VALID_PRIORITIES.includes(priority) ? priority : 'medium';
    const ticket_number = makeTicketNumber();

    // Get customer profile for name/email/phone
    const [cust] = await safeQ('SELECT full_name, email, phone FROM customers WHERE id=?', [cid]);

    const [r] = await pool.execute(
      `INSERT INTO customer_support_tickets
         (ticket_number, customer_id, customer_name, customer_email, customer_phone, subject, category, priority, status)
       VALUES (?,?,?,?,?,?,?,?,'open')`,
      [ticket_number, cid, cust?.full_name || null, cust?.email || null, cust?.phone || null, subject, cat, pri]
    );
    const ticketId = r.insertId;

    // Save initial message
    await pool.execute(
      'INSERT INTO customer_support_messages (ticket_id, sender_type, sender_id, sender_name, message) VALUES (?,?,?,?,?)',
      [ticketId, 'customer', cid, cust?.full_name || 'Customer', message]
    );

    // Create admin notification for new support ticket
    createAdminNotification({
      type: 'support_ticket',
      title: 'New Support Ticket',
      message: `New ticket #${ticket_number}: ${subject}`,
      module_name: 'support_tickets',
      record_id: ticketId,
      action_url: `/admin/support-tickets/${ticketId}`,
      priority: pri === 'urgent' || pri === 'high' ? 'high' : 'normal',
      created_by_type: 'customer',
      created_by_id: cid,
      metadata: { ticket_number, subject, category, priority: pri }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    const [rows] = await pool.execute('SELECT * FROM customer_support_tickets WHERE id=?', [ticketId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('createTicket error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/customer-support/tickets/:id/messages
exports.addMessage = async (req, res) => {
  try {
    const cid = req.customer.id;
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    const rows = await safeQ('SELECT * FROM customer_support_tickets WHERE id=? AND customer_id=?', [req.params.id, cid]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket not found' });
    const ticket = rows[0];
    if (['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Cannot reply to a resolved or closed ticket' });
    }

    const [cust] = await safeQ('SELECT full_name FROM customers WHERE id=?', [cid]);
    await pool.execute(
      'INSERT INTO customer_support_messages (ticket_id, sender_type, sender_id, sender_name, message) VALUES (?,?,?,?,?)',
      [req.params.id, 'customer', cid, cust?.full_name || 'Customer', message.trim()]
    );
    await pool.execute("UPDATE customer_support_tickets SET status='open', updated_at=NOW() WHERE id=?", [req.params.id]);

    // Create admin notification for customer reply
    createAdminNotification({
      type: 'support_reply',
      title: 'Customer Replied to Ticket',
      message: `Customer replied to ticket #${ticket.ticket_number}`,
      module_name: 'support_tickets',
      record_id: req.params.id,
      action_url: `/admin/support-tickets/${req.params.id}`,
      priority: 'normal',
      created_by_type: 'customer',
      created_by_id: cid,
      metadata: { ticket_number: ticket.ticket_number }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    const msgs = await safeQ('SELECT * FROM customer_support_messages WHERE ticket_id=? ORDER BY created_at ASC', [req.params.id]);
    return res.status(201).json({ success: true, data: msgs[msgs.length - 1] });
  } catch (err) {
    console.error('addMessage error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
