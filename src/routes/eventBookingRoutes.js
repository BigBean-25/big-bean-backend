const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  markPaymentFailed,
  getBookingByNumber,
  downloadTicketPdf,
} = require('../controllers/eventBookingController');

router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.post('/mark-payment-failed', markPaymentFailed);
router.get('/:bookingNumber/ticket-pdf', downloadTicketPdf);
router.get('/:bookingNumber', getBookingByNumber);

module.exports = router;
