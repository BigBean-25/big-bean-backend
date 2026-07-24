const { pool } = require('../config/database');

const safeQuery = async (sql, params = []) => {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch { return []; }
};

const buildOrdersWhere = (cid, email, phone) => {
  const params = [cid];
  let where = 'customer_id = ?';
  if (email) {
    where += ' OR (customer_id IS NULL AND LOWER(TRIM(customer_email)) = LOWER(TRIM(?)))';
    params.push(email);
  }
  if (phone) {
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    where += ' OR (customer_id IS NULL AND REPLACE(REPLACE(REPLACE(REPLACE(customer_phone," ",""),"-",""),"(",""),")","") LIKE ?)';
    params.push('%' + cleanPhone.slice(-10));
  }
  return { where, params };
};

exports.getSummary = async (req, res) => {
  try {
    const cid = req.customer.id;
    const [profile] = await pool.execute('SELECT * FROM customers WHERE id=?', [cid]);
    if (!profile.length) return res.status(404).json({ success: false, message: 'Not found' });
    const { password_hash, ...p } = profile[0];

    const { where, params } = buildOrdersWhere(cid, p.email, p.phone);
    const orders = await safeQuery(
      `SELECT * FROM merchandise_orders WHERE ${where} ORDER BY created_at DESC LIMIT 5`,
      params
    );
    const totalOrdersRows = await safeQuery(
      `SELECT COUNT(*) as cnt FROM merchandise_orders WHERE ${where}`,
      params
    );
    const totalSpentRows = await safeQuery(
      `SELECT COALESCE(SUM(total_amount),0) as total FROM merchandise_orders WHERE ${where}`,
      params
    );
    const [addrCount] = await safeQuery('SELECT COUNT(*) as cnt FROM customer_addresses WHERE customer_id=?', [cid]);
    const [wishCount] = await safeQuery('SELECT COUNT(*) as cnt FROM customer_wishlist WHERE customer_id=?', [cid]);
    const [ticketCount] = await safeQuery('SELECT COUNT(*) as cnt FROM customer_support_tickets WHERE customer_id=?', [cid]);

    return res.json({
      success: true,
      data: {
        profile: p,
        stats: {
          total_orders: totalOrdersRows[0]?.cnt || 0,
          total_spent: totalSpentRows[0]?.total || 0,
          addresses_count: addrCount?.cnt || 0,
          wishlist_count: wishCount?.cnt || 0,
          support_tickets_count: ticketCount?.cnt || 0,
        },
        recent_orders: orders,
        login_info: { last_login_at: p.last_login_at, login_count: p.login_count },
      },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const cid = req.customer.id;
    const [profile] = await pool.execute('SELECT email,phone FROM customers WHERE id=?', [cid]);
    const { email = '', phone = '' } = profile[0] || {};
    const { where, params } = buildOrdersWhere(cid, email, phone);
    const orders = await safeQuery(
      `SELECT id, order_number, customer_name, total_amount, payment_method, payment_status,
              order_status, created_at,
              (SELECT COUNT(*) FROM merchandise_order_items WHERE order_id = merchandise_orders.id) AS items_count
       FROM merchandise_orders WHERE ${where} ORDER BY created_at DESC`,
      params
    );
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CustomerOrders] cid=${cid} found=${orders.length}`);
    }
    return res.json({ success: true, data: orders });
  } catch (err) {
    console.error('getOrders error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const cid = req.customer.id;
    const { id } = req.params;
    const [profile] = await pool.execute('SELECT email,phone FROM customers WHERE id=?', [cid]);
    const { email = '', phone = '' } = profile[0] || {};
    const { where, params } = buildOrdersWhere(cid, email, phone);
    // Ownership check
    const orders = await safeQuery(
      `SELECT * FROM merchandise_orders WHERE id = ? AND (${where})`,
      [id, ...params]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const items = await safeQuery(
      'SELECT oi.*, m.image AS product_image FROM merchandise_order_items oi LEFT JOIN merchandise m ON m.id = oi.merchandise_id WHERE oi.order_id = ?',
      [id]
    );
    const history = await safeQuery(
      'SELECT * FROM merchandise_order_status_history WHERE order_id = ? ORDER BY created_at ASC',
      [id]
    );
    return res.json({ success: true, data: { ...orders[0], items, history } });
  } catch (err) {
    console.error('getOrderById error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAddresses = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM customer_addresses WHERE customer_id=? ORDER BY is_default DESC, created_at DESC', [req.customer.id]);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const cid = req.customer.id;
    const { label, full_name, phone, address_line_1, address_line_2, landmark, city, state, pincode, is_default } = req.body;
    if (!address_line_1) return res.status(400).json({ success: false, message: 'address_line_1 required' });
    if (is_default) await pool.execute('UPDATE customer_addresses SET is_default=0 WHERE customer_id=?', [cid]);
    const [r] = await pool.execute(
      'INSERT INTO customer_addresses (customer_id,label,full_name,phone,address_line_1,address_line_2,landmark,city,state,pincode,is_default) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [cid, label||'Home', full_name||null, phone||null, address_line_1, address_line_2||null, landmark||null, city||'Bengaluru', state||'Karnataka', pincode||null, is_default?1:0]
    );
    const [rows] = await pool.execute('SELECT * FROM customer_addresses WHERE id=?', [r.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const cid = req.customer.id;
    const { id } = req.params;
    const { label, full_name, phone, address_line_1, address_line_2, landmark, city, state, pincode, is_default } = req.body;
    if (is_default) await pool.execute('UPDATE customer_addresses SET is_default=0 WHERE customer_id=?', [cid]);
    await pool.execute(
      'UPDATE customer_addresses SET label=COALESCE(?,label),full_name=COALESCE(?,full_name),phone=COALESCE(?,phone),address_line_1=COALESCE(?,address_line_1),address_line_2=COALESCE(?,address_line_2),landmark=COALESCE(?,landmark),city=COALESCE(?,city),state=COALESCE(?,state),pincode=COALESCE(?,pincode),is_default=COALESCE(?,is_default),updated_at=NOW() WHERE id=? AND customer_id=?',
      [label||null,full_name||null,phone||null,address_line_1||null,address_line_2||null,landmark||null,city||null,state||null,pincode||null,is_default!=null?is_default:null,id,cid]
    );
    const [rows] = await pool.execute('SELECT * FROM customer_addresses WHERE id=?', [id]);
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    await pool.execute('DELETE FROM customer_addresses WHERE id=? AND customer_id=?', [req.params.id, req.customer.id]);
    return res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT cw.*, m.name, m.price, m.images FROM customer_wishlist cw LEFT JOIN merchandise m ON m.id=cw.merchandise_id WHERE cw.customer_id=? ORDER BY cw.created_at DESC',
      [req.customer.id]
    );
    return res.json({ success: true, data: rows });
  } catch {
    const [rows] = await pool.execute('SELECT * FROM customer_wishlist WHERE customer_id=?', [req.customer.id]);
    return res.json({ success: true, data: rows });
  }
};

exports.addWishlist = async (req, res) => {
  try {
    const { merchandise_id } = req.body;
    await pool.execute('INSERT IGNORE INTO customer_wishlist (customer_id,merchandise_id) VALUES (?,?)', [req.customer.id, merchandise_id]);
    return res.status(201).json({ success: true, message: 'Added to wishlist' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.removeWishlist = async (req, res) => {
  try {
    await pool.execute('DELETE FROM customer_wishlist WHERE customer_id=? AND merchandise_id=?', [req.customer.id, req.params.merchandise_id]);
    return res.json({ success: true, message: 'Removed' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM customer_support_tickets WHERE customer_id=? ORDER BY created_at DESC', [req.customer.id]);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ success: false, message: 'Subject and message required' });
    const [r] = await pool.execute('INSERT INTO customer_support_tickets (customer_id,subject,message) VALUES (?,?,?)', [req.customer.id, subject, message]);
    const [rows] = await pool.execute('SELECT * FROM customer_support_tickets WHERE id=?', [r.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
