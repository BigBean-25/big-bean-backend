const express = require('express');
const router = express.Router();
const {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservationStatus,
  sendEmail,
  sendWhatsApp,
  getCommLogs,
  deleteReservation,
  getReservationStats,
  getAvailableTimeSlots
} = require('../controllers/reservationController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all reservations with optional filters (admin only)
router.get('/', verifyAdminToken, requirePermission('reservations', 'view'), getAllReservations);

// Get reservation statistics
router.get('/stats', getReservationStats);

// Get available time slots for a date
router.get('/available-slots', getAvailableTimeSlots);

// Get reservation by ID
router.get('/:id', getReservationById);

// Create new reservation (public)
router.post('/', createReservation);

// Update reservation status
router.put('/:id/status', verifyAdminToken, requirePermission('reservations', 'edit'), updateReservationStatus);

// Notification routes
router.post('/:id/send-email', verifyAdminToken, requirePermission('reservations', 'create'), sendEmail);
router.post('/:id/send-whatsapp', verifyAdminToken, requirePermission('reservations', 'create'), sendWhatsApp);
router.get('/:id/logs', getCommLogs);

// Delete reservation
router.delete('/:id', verifyAdminToken, requirePermission('reservations', 'delete'), deleteReservation);

module.exports = router;
