const { pool } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { search = '', status = '' } = req.query;
    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    let rows;
    try {
      // Try with orders JOIN (requires customer_id column on merchandise_orders)
      const [r] = await pool.execute(
        `SELECT c.*, COALESCE(o.total_orders,0) AS total_orders, COALESCE(o.total_spent,0) AS total_spent
         FROM customers c
         LEFT JOIN (
           SELECT customer_id, COUNT(*) AS total_orders, SUM(total_amount) AS total_spent
           FROM merchandise_orders WHERE customer_id IS NOT NULL GROUP BY customer_id
         ) o ON o.customer_id = c.id
         ${where} ORDER BY c.created_at DESC`,
        params
      );
      rows = r;
    } catch {
      // Fallback: plain customers without order stats
      const [r] = await pool.execute(
        `SELECT c.*, 0 AS total_orders, 0 AS total_spent FROM customers c ${where} ORDER BY c.created_at DESC`,
        params
      );
      rows = r;
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Admin getCustomers error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM customers WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const { password_hash, ...c } = rows[0];
    const [addrs] = await pool.execute('SELECT * FROM customer_addresses WHERE customer_id=?', [id]);
    const [wish] = await pool.execute('SELECT COUNT(*) as cnt FROM customer_wishlist WHERE customer_id=?', [id]);
    const orders = await (async () => { try { const [r] = await pool.execute('SELECT * FROM merchandise_orders WHERE customer_id=? OR customer_email=? OR customer_phone=? ORDER BY created_at DESC LIMIT 10',[id,c.email||'',c.phone||'']); return r; } catch { return []; } })();
    return res.json({ success: true, data: { ...c, addresses: addrs, wishlist_count: wish[0]?.cnt||0, orders } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM customer_login_logs WHERE customer_id=? ORDER BY created_at DESC LIMIT 100', [req.params.id]);
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','inactive','blocked'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    await pool.execute('UPDATE customers SET status=? WHERE id=?', [status, req.params.id]);
    return res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    await pool.execute('DELETE FROM customers WHERE id=?', [req.params.id]);
    return res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
