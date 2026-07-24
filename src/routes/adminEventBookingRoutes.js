const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const {
  getAdminBookings,
  getAdminBookingById,
  updateBookingStatus,
  checkInBooking,
  getDashboardSummary,
  exportExcel,
  exportPdf,
} = require('../controllers/adminEventBookingController');

router.get(
  '/',
  verifyAdminToken,
  requirePermission('event_bookings', 'view'),
  getAdminBookings
);

router.get(
  '/summary/dashboard',
  verifyAdminToken,
  requirePermission('event_bookings', 'view'),
  getDashboardSummary
);

router.get(
  '/export/excel',
  verifyAdminToken,
  requirePermission('event_bookings', 'export'),
  exportExcel
);

router.get(
  '/export/pdf',
  verifyAdminToken,
  requirePermission('event_bookings', 'export'),
  exportPdf
);

router.get(
  '/:id',
  verifyAdminToken,
  requirePermission('event_bookings', 'view'),
  getAdminBookingById
);

router.put(
  '/:id/status',
  verifyAdminToken,
  requirePermission('event_bookings', 'edit'),
  updateBookingStatus
);

router.post(
  '/:id/check-in',
  verifyAdminToken,
  requirePermission('event_bookings', 'edit'),
  checkInBooking
);

module.exports = router;
