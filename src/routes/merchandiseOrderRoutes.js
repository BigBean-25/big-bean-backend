const express = require('express');
const router = express.Router();
const {
  getAllOrders, getOrderById, createOrder, updateOrderStatus,
  sendEmailNotification, sendWhatsAppNotification, deleteOrder, markPaymentFailed,
} = require('../controllers/merchandiseOrderController');
const {
  getMerchandiseOrdersReport, getMerchandiseOrdersReportPdf, getMerchandiseOrdersReportExcel,
} = require('../controllers/merchandiseOrderReportController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { generateInvoicePdf } = require('../services/invoicePdfService');
const { executeQuery } = require('../config/database');

// Get all orders - requires merchandise_orders.view
router.get('/', verifyAdminToken, requirePermission('merchandise_orders', 'view'), getAllOrders);

// Report endpoints
router.get('/report', verifyAdminToken, requirePermission('merchandise_orders', 'view'), getMerchandiseOrdersReport);
router.get('/report/pdf', verifyAdminToken, requirePermission('merchandise_orders', 'export'), getMerchandiseOrdersReportPdf);
router.get('/report/excel', verifyAdminToken, requirePermission('merchandise_orders', 'export'), getMerchandiseOrdersReportExcel);

// Get order by ID - requires merchandise_orders.view
router.get('/:id', verifyAdminToken, requirePermission('merchandise_orders', 'view'), getOrderById);

// Generate invoice PDF - requires merchandise_orders.view
router.get('/:id/invoice-pdf', verifyAdminToken, requirePermission('merchandise_orders', 'view'), async (req, res) => {
  try {
    const orders = await executeQuery('SELECT * FROM merchandise_orders WHERE id=?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Order not found' });
    const order = orders[0];
    const items = await executeQuery(
      'SELECT oi.*, m.image AS product_image FROM merchandise_order_items oi LEFT JOIN merchandise m ON m.id=oi.merchandise_id WHERE oi.order_id=?',
      [req.params.id]
    );
    order.items = items;
    generateInvoicePdf(order, res);
  } catch (err) {
    console.error('Invoice PDF error:', err);
    res.status(500).json({ success: false, message: 'Could not generate PDF' });
  }
});

// Create order (public - no auth required for customer checkout)
router.post('/', createOrder);

// Update order status - requires merchandise_orders.edit
router.put('/:id/status', verifyAdminToken, requirePermission('merchandise_orders', 'edit'), updateOrderStatus);

// Mark payment as failed - public (called from checkout after payment failure, no auth required)
router.put('/:id/payment-failed', markPaymentFailed);
router.post('/:id/payment-failed', markPaymentFailed);

// Send email notification - requires merchandise_orders.edit
router.post('/:id/send-email', verifyAdminToken, requirePermission('merchandise_orders', 'edit'), sendEmailNotification);

// Send WhatsApp notification - requires merchandise_orders.edit
router.post('/:id/send-whatsapp', verifyAdminToken, requirePermission('merchandise_orders', 'edit'), sendWhatsAppNotification);

// Delete order - requires merchandise_orders.delete
router.delete('/:id', verifyAdminToken, requirePermission('merchandise_orders', 'delete'), deleteOrder);

module.exports = router;
