const express = require('express');
const router = express.Router();
const {
  getAdminEvents,
  createEvent,
  getAdminEventById,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { eventUpload } = require('../config/multer');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', verifyAdminToken, requirePermission('events', 'view'), getAdminEvents);
router.post(
  '/',
  verifyAdminToken,
  requirePermission('events', 'create'),
  eventUpload.fields([
    { name: 'event_banner', maxCount: 1 },
    { name: 'event_thumbnail', maxCount: 1 },
  ]),
  createEvent
);
router.get('/:id', verifyAdminToken, requirePermission('events', 'view'), getAdminEventById);
router.put(
  '/:id',
  verifyAdminToken,
  requirePermission('events', 'edit'),
  eventUpload.fields([
    { name: 'event_banner', maxCount: 1 },
    { name: 'event_thumbnail', maxCount: 1 },
  ]),
  updateEvent
);
router.delete('/:id', verifyAdminToken, requirePermission('events', 'delete'), deleteEvent);

module.exports = router;
