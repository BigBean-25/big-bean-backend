const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerDashboardController');
const { customerAuth } = require('../middleware/customerAuthMiddleware');
const { generateInvoicePdf } = require('../services/invoicePdfService');
const { pool } = require('../config/database');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'bigbean_dev_secret_2024';

router.use(customerAuth);

router.get('/summary', ctrl.getSummary);
router.get('/orders', ctrl.getOrders);
router.get('/orders/:id', ctrl.getOrderById);

router.get('/orders/:id/invoice-pdf', async (req, res) => {
  try {
    const cid = req.customer.id;
    const orderId = req.params.id;
    // Ownership check via getOrderById logic
    const [profile] = await pool.execute('SELECT email,phone FROM customers WHERE id=?', [cid]);
    const { email = '', phone = '' } = profile[0] || {};
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');

    let where = 'customer_id = ?';
    const params = [cid];
    if (email) { where += ' OR (customer_id IS NULL AND LOWER(TRIM(customer_email)) = LOWER(TRIM(?)))'; params.push(email); }
    if (cleanPhone) { where += ' OR (customer_id IS NULL AND REPLACE(REPLACE(REPLACE(REPLACE(customer_phone," ",""),"-",""),"(",""),")","") LIKE ?)'; params.push('%' + cleanPhone.slice(-10)); }

    const [orders] = await pool.execute(`SELECT * FROM merchandise_orders WHERE id = ? AND (${where})`, [orderId, ...params]);
    if (!orders.length) return res.status(403).json({ success: false, message: 'Order not found or access denied' });

    const [items] = await pool.execute(
      'SELECT oi.*, m.image AS product_image FROM merchandise_order_items oi LEFT JOIN merchandise m ON m.id=oi.merchandise_id WHERE oi.order_id=?',
      [orderId]
    );
    const order = orders[0];
    order.items = items;
    generateInvoicePdf(order, res);
  } catch (err) {
    console.error('Customer invoice PDF error:', err);
    res.status(500).json({ success: false, message: 'Could not generate PDF' });
  }
});
router.get('/addresses', ctrl.getAddresses);
router.post('/addresses', ctrl.addAddress);
router.put('/addresses/:id', ctrl.updateAddress);
router.delete('/addresses/:id', ctrl.deleteAddress);
router.get('/wishlist', ctrl.getWishlist);
router.post('/wishlist', ctrl.addWishlist);
router.delete('/wishlist/:merchandise_id', ctrl.removeWishlist);
router.get('/support-tickets', ctrl.getTickets);
router.post('/support-tickets', ctrl.createTicket);

module.exports = router;
