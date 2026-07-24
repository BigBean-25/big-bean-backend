const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { lookupBooking, confirmCheckin } = require('../controllers/adminEventCheckinController');

router.post('/lookup', verifyAdminToken, requirePermission('event_bookings', 'edit'), lookupBooking);
router.post('/confirm', verifyAdminToken, requirePermission('event_bookings', 'edit'), confirmCheckin);

module.exports = router;
