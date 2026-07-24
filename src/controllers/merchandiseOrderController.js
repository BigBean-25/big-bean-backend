const { executeQuery } = require('../config/database');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bigbean_dev_secret_2024';
const { createAdminNotification } = require('../services/adminNotificationService');
const { getDataScopeFilter } = require('../middleware/authMiddleware');

const toBool = (v) => {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

// Normalize frontend-sent status strings to backend canonical values
const normalizeStatus = (raw) => {
  const s = String(raw || '').toLowerCase().trim().replace(/[^a-z]/g, '_');
  const ALIAS = {
    pending:                   'received',
    order_received:            'received',
    received:                  'received',
    team_confirmation:         'confirmed',
    confirmed:                 'confirmed',
    order_confirmed:           'confirmed',
    packing:                   'packing',
    packed:                    'packing',
    ready:                     'ready',
    ready_delivery_update:     'ready',
    delivery_update:           'ready',
    delivered:                 'delivered',
    completed:                 'delivered',
    cancelled:                 'cancelled',
    canceled:                  'cancelled',
  };
  return ALIAS[s] || null;
};

const makeOrderNumber = () => {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.random().toString(36).substring(2,7).toUpperCase();
  return `BBCM-${date}-${rand}`;
};

const VALID_STATUSES = ['received','confirmed','packing','ready','delivered','cancelled'];

// ── Migrate order_status column from ENUM to VARCHAR if needed ───────────────
let _orderStatusMigrated = false;
const ensureOrderStatusColumn = async () => {
  if (_orderStatusMigrated) return;
  _orderStatusMigrated = true;
  try {
    const cols = await executeQuery("SHOW COLUMNS FROM merchandise_orders LIKE 'order_status'");
    if (cols.length && cols[0].Type && cols[0].Type.toLowerCase().startsWith('enum')) {
      await executeQuery(
        "ALTER TABLE merchandise_orders MODIFY COLUMN order_status VARCHAR(80) NOT NULL DEFAULT 'received'"
      );
      await executeQuery("UPDATE merchandise_orders SET order_status = 'received' WHERE order_status = 'pending'").catch(() => {});
      await executeQuery("UPDATE merchandise_orders SET order_status = 'packing'  WHERE order_status = 'packed'").catch(() => {});
      await executeQuery("UPDATE merchandise_orders SET order_status = 'delivered' WHERE order_status = 'completed'").catch(() => {});
      console.log('✅ merchandise_orders.order_status migrated from ENUM to VARCHAR');
    }
  } catch (e) {
    console.warn('order_status migration warn:', e.message);
  }
};

// ── Ensure status history table exists ──────────────────────────────────────
const ensureHistoryTable = async () => {
  await ensureOrderStatusColumn();
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS merchandise_order_status_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      status VARCHAR(80) NOT NULL,
      message TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).catch(() => {});
};

// ── Insert status history entry ──────────────────────────────────────────────
const addHistory = async (orderId, status, message = null) => {
  await ensureHistoryTable();
  await executeQuery(
    'INSERT INTO merchandise_order_status_history (order_id, status, message) VALUES (?, ?, ?)',
    [orderId, status, message]
  ).catch(() => {});
};

// ── GET all orders ────────────────────────────────────────────────────────────
const getAllOrders = async (req, res) => {
  try {
    let query = `SELECT id, order_number, customer_name, customer_phone, customer_email,
              total_amount, order_status, payment_method, payment_status,
              payment_provider, payment_id, payment_order_id, created_at
       FROM merchandise_orders`;
    const params = [];
    const where = [];

    const scope = await getDataScopeFilter(req.admin || req.user, 'merchandise_orders', 'merchandise_orders');
    if (scope.clause) {
      where.push(scope.clause);
      params.push(...scope.params);
    }

    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const orders = await executeQuery(query, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── GET order by ID with items + history ─────────────────────────────────────
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const items = await executeQuery(
      `SELECT oi.*, m.image AS product_image
       FROM merchandise_order_items oi
       LEFT JOIN merchandise m ON m.id = oi.merchandise_id
       WHERE oi.order_id = ?`,
      [id]
    );
    await ensureHistoryTable();
    const history = await executeQuery(
      'SELECT * FROM merchandise_order_status_history WHERE order_id = ? ORDER BY created_at ASC',
      [id]
    ).catch(() => []);
    res.json({ success: true, data: { ...orders[0], items, history } });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Helper: deduct stock ──────────────────────────────────────────────────────
const deductStock = async (items) => {
  for (const item of items) {
    if (!item.merchandise_id) continue;
    const qty = parseInt(item.quantity) || 1;
    await executeQuery(
      'UPDATE merchandise SET stock = GREATEST(0, stock - ?) WHERE id = ?',
      [qty, item.merchandise_id]
    ).catch(() => {});
  }
};

// ── POST create order ─────────────────────────────────────────────────────────
const createOrder = async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, address, notes, payment_method, items } = req.body;

    // Optional customer auth — guest checkout still works
    let customerId = null;
    try {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.type === 'customer' && decoded.id) {
          customerId = decoded.id;
        }
      }
    } catch (err) {
      console.warn('Optional customer auth (order create):', err.message);
    }
    if (!customer_name || !customer_phone || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'customer_name, customer_phone, and items are required' });
    }

    for (const item of items) {
      if (!item.merchandise_id) continue;
      const qty = parseInt(item.quantity) || 1;
      const rows = await executeQuery('SELECT name, stock FROM merchandise WHERE id = ?', [item.merchandise_id]);
      if (!rows.length) continue;
      const prod = rows[0];
      const available = parseInt(prod.stock) || 0;
      if (available < qty) {
        return res.status(400).json({
          success: false,
          message: `"${prod.name}" has only ${available} item${available !== 1 ? 's' : ''} available.`,
        });
      }
    }

    const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.price) * parseInt(i.quantity)), 0);
    const delivery_charge = 0;
    const total_amount = subtotal + delivery_charge;
    const order_number = makeOrderNumber();

    const result = await executeQuery(
      `INSERT INTO merchandise_orders (order_number, customer_id, customer_name, customer_phone, customer_email, address, notes, subtotal, delivery_charge, total_amount, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_number,
        customerId,
        customer_name.trim(),
        customer_phone.trim(),
        customer_email || null,
        address || null,
        notes || null,
        subtotal,
        delivery_charge,
        total_amount,
        payment_method || 'cod',
      ]
    );
    const orderId = result.insertId;

    for (const item of items) {
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      await executeQuery(
        `INSERT INTO merchandise_order_items (order_id, merchandise_id, product_name, quantity, price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.merchandise_id || null, item.product_name, qty, price, qty * price]
      );
    }

    await addHistory(orderId, 'received', 'Order placed');

    // Create admin notification for new order
    createAdminNotification({
      type: 'new_order',
      title: 'New Order Received',
      message: `Order #${order_number} placed by ${customer_name.trim()} for ₹${total_amount}`,
      module_name: 'merchandise_orders',
      record_id: orderId,
      action_url: `/admin/merchandise-orders/${orderId}`,
      priority: 'high',
      created_by_type: customerId ? 'customer' : 'guest',
      created_by_id: customerId,
      metadata: { order_number, total_amount, payment_method, payment_status: 'pending' }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    const isOnlinePayment = (payment_method || '').toLowerCase().includes('online');
    if (isOnlinePayment) {
      // For online payment, set payment_status to payment_initiated
      await executeQuery(
        "UPDATE merchandise_orders SET payment_status = 'payment_initiated', order_status = 'payment_initiated' WHERE id = ?",
        [orderId]
      );
      // Do not deduct stock, do not send email, do not create notification yet
      // These will happen after successful payment verification
    } else {
      await deductStock(items);
      // Auto email for COD
      try {
        const order = { id: orderId, order_number, customer_name, customer_email, customer_phone, total_amount, payment_method };
        const { sendOrderEmail, sendAdminOrderNotification } = require('../services/mailService');
        await sendOrderEmail(order, 'received');
        await sendAdminOrderNotification(order);
      } catch (e) { console.error('COD auto-email error:', e.message); }
    }

    res.status(201).json({ success: true, message: 'Order placed successfully', data: { id: orderId, order_number } });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT update order status ───────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const rawStatus = req.body.order_status || req.body.status || '';
    const nextStatus = normalizeStatus(rawStatus);
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: `Invalid order status "${rawStatus}". Valid: ${VALID_STATUSES.join(', ')}`,
      });
    }
    const existing = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Order not found' });
    await executeQuery(
      'UPDATE merchandise_orders SET order_status = ?, updated_at = NOW() WHERE id = ?',
      [nextStatus, id]
    );
    try {
      await addHistory(id, nextStatus, req.body.message || `Status updated to ${nextStatus}`);
    } catch (he) { console.warn('History insert warn:', he.message); }

    if (toBool(req.body.send_email) && existing[0].customer_email) {
      try {
        const { sendOrderEmail } = require('../services/mailService');
        await sendOrderEmail({ ...existing[0], order_status: nextStatus }, nextStatus);
      } catch (e) { console.error('Status email error:', e.message); }
    }

    res.json({ success: true, message: 'Order status updated successfully', order_status: nextStatus });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST send email notification ──────────────────────────────────────────────
const sendEmailNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const orders = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orders[0];

    if (!order.customer_email) {
      return res.status(400).json({ success: false, message: 'Customer email is missing for this order.' });
    }

    // Pre-check SMTP settings before attempting to send
    const settingRows = await executeQuery(
      `SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?,?,?,?,?)`,
      ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password']
    ).catch(() => []);
    const cfg = {};
    settingRows.forEach(r => { cfg[r.setting_key] = r.setting_value; });

    if (!toBool(cfg.smtp_enabled)) {
      return res.status(400).json({
        success: false,
        message: 'SMTP is not enabled. Please configure Email / SMTP in Settings.',
      });
    }
    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_password) {
      return res.status(400).json({
        success: false,
        message: 'SMTP configuration is incomplete. Please check smtp_host, smtp_user and smtp_password in Settings.',
      });
    }

    const emailStatus = normalizeStatus(status) || order.order_status || 'received';
    const { sendOrderEmail } = require('../services/mailService');
    const result = await sendOrderEmail(order, emailStatus);

    if (result.success) {
      res.json({ success: true, message: `Email sent successfully to ${order.customer_email}` });
    } else {
      res.status(400).json({ success: false, message: result.reason || 'Email could not be sent. Please check SMTP settings.' });
    }
  } catch (error) {
    console.error('sendEmailNotification error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── POST send WhatsApp notification ──────────────────────────────────────────
const sendWhatsAppNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const orders = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orders[0];
    const { sendWhatsApp } = require('../services/whatsappService');
    const result = await sendWhatsApp(order, status || order.order_status || 'received');
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('sendWhatsAppNotification error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── DELETE order ──────────────────────────────────────────────────────────────
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM merchandise_orders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Order not found' });
    await executeQuery('DELETE FROM merchandise_order_items WHERE order_id = ?', [id]);
    await executeQuery('DELETE FROM merchandise_orders WHERE id = ?', [id]);
    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── PUT mark order as payment failed ───────────────────────────────────────────
const markPaymentFailed = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await executeQuery('SELECT * FROM merchandise_orders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Order not found' });

    const order = existing[0];
    if (order.payment_method !== 'online') {
      return res.status(400).json({ success: false, message: 'This endpoint is only for online payment orders' });
    }
    if (order.payment_status && !['pending', 'payment_initiated'].includes(order.payment_status)) {
      return res.status(400).json({ success: false, message: 'Order payment status is not eligible for failure marking' });
    }

    await executeQuery(
      "UPDATE merchandise_orders SET payment_status = 'failed', order_status = 'payment_failed', updated_at = NOW() WHERE id = ?",
      [id]
    );

    await addHistory(id, 'payment_failed', reason || 'Razorpay order creation failed');

    // Create admin notification for payment failed
    createAdminNotification({
      type: 'payment_failed',
      title: 'Online Payment Failed',
      message: `Online payment failed for Order #${order.order_number}. ${reason || 'Razorpay order creation failed'}`,
      module_name: 'merchandise_orders',
      record_id: id,
      action_url: `/admin/merchandise-orders/${id}`,
      priority: 'high',
      metadata: { order_number: order.order_number, total_amount: order.total_amount, reason }
    }).catch(err => console.warn('Admin notification failed:', err.message));

    res.json({ success: true, message: 'Order marked as payment failed' });
  } catch (error) {
    console.error('Mark payment failed error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Build WHERE clause for merchandise orders report ─────────────────────────
const buildMerchandiseOrderReportWhere = async (query, admin) => {
  const where = [];
  const params = [];
  const errors = [];

  const {
    search, date_filter_type, from_date, to_date,
    from_month, to_month, week_start, week_end, exact_date,
    payment_method, payment_status, order_status, min_amount, max_amount
  } = query;

  // Data scope
  const scope = await getDataScopeFilter(admin, 'merchandise_orders', 'mo');
  if (scope.clause) {
    where.push(scope.clause);
    params.push(...scope.params);
  }

  // Search across order number, customer details and Razorpay IDs
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    where.push(
      `(mo.order_number LIKE ? OR mo.customer_name LIKE ? OR mo.customer_phone LIKE ? OR mo.customer_email LIKE ? OR mo.payment_order_id LIKE ? OR mo.payment_id LIKE ?)`
    );
    params.push(q, q, q, q, q, q);
  }

  // Date filters
  const dft = (date_filter_type || '').toString().toLowerCase();
  if (dft) {
    switch (dft) {
      case 'today':
        where.push(`DATE(mo.created_at) = CURDATE()`);
        break;
      case 'yesterday':
        where.push(`DATE(mo.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)`);
        break;
      case 'this_week':
        where.push(`YEARWEEK(mo.created_at, 1) = YEARWEEK(CURDATE(), 1)`);
        break;
      case 'last_week':
        where.push(`YEARWEEK(mo.created_at, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)`);
        break;
      case 'this_month':
        where.push(`YEAR(mo.created_at) = YEAR(CURDATE()) AND MONTH(mo.created_at) = MONTH(CURDATE())`);
        break;
      case 'last_month':
        where.push(`YEAR(mo.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(mo.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`);
        break;
      case 'custom_range':
        if (from_date) { where.push(`DATE(mo.created_at) >= ?`); params.push(from_date); }
        if (to_date) { where.push(`DATE(mo.created_at) <= ?`); params.push(to_date); }
        if (from_date && to_date && from_date > to_date) errors.push('From date cannot be after to date');
        break;
      case 'month_to_month':
        if (from_month) { where.push(`DATE_FORMAT(mo.created_at, '%Y-%m') >= ?`); params.push(from_month); }
        if (to_month) { where.push(`DATE_FORMAT(mo.created_at, '%Y-%m') <= ?`); params.push(to_month); }
        if (from_month && to_month && from_month > to_month) errors.push('From month cannot be after to month');
        break;
      case 'week_wise':
        if (week_start) { where.push(`DATE(mo.created_at) >= ?`); params.push(week_start); }
        if (week_end) { where.push(`DATE(mo.created_at) <= ?`); params.push(week_end); }
        if (week_start && week_end && week_start > week_end) errors.push('Week start cannot be after week end');
        break;
      case 'date_wise':
        if (exact_date) { where.push(`DATE(mo.created_at) = ?`); params.push(exact_date); }
        break;
      default:
        break;
    }
  }

  // Payment method
  if (payment_method && String(payment_method).toLowerCase() !== 'all') {
    where.push(`LOWER(mo.payment_method) = ?`);
    params.push(String(payment_method).toLowerCase());
  }

  // Payment status
  if (payment_status && String(payment_status).toLowerCase() !== 'all') {
    const ps = String(payment_status).toLowerCase();
    if (ps === 'failed' || ps === 'payment_failed') {
      where.push(`(mo.payment_status = 'failed' OR mo.order_status = 'payment_failed')`);
    } else {
      where.push(`mo.payment_status = ?`);
      params.push(ps);
    }
  }

  // Order status
  if (order_status && String(order_status).toLowerCase() !== 'all') {
    where.push(`mo.order_status = ?`);
    params.push(String(order_status).toLowerCase());
  }

  // Amount range
  const minAmt = min_amount !== undefined && min_amount !== '' ? parseFloat(min_amount) : null;
  const maxAmt = max_amount !== undefined && max_amount !== '' ? parseFloat(max_amount) : null;
  if (minAmt !== null && !isNaN(minAmt)) {
    where.push(`mo.total_amount >= ?`);
    params.push(minAmt);
  }
  if (maxAmt !== null && !isNaN(maxAmt)) {
    where.push(`mo.total_amount <= ?`);
    params.push(maxAmt);
  }

  return { where, params, errors };
};

module.exports = {
  getAllOrders, getOrderById, createOrder, updateOrderStatus,
  sendEmailNotification, sendWhatsAppNotification, deleteOrder, deductStock, addHistory, markPaymentFailed,
  buildMerchandiseOrderReportWhere,
};
