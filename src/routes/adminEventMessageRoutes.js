const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const {
  getTemplates,
  getTemplateByKey,
  updateTemplate,
  sendEventEmail,
  sendEventWhatsApp,
} = require('../controllers/eventMessageController');

router.get(
  '/event-message-templates',
  verifyAdminToken,
  requirePermission('event_bookings', 'view'),
  getTemplates
);

router.get(
  '/event-message-templates/:templateKey',
  verifyAdminToken,
  requirePermission('event_bookings', 'view'),
  getTemplateByKey
);

router.put(
  '/event-message-templates/:templateKey',
  verifyAdminToken,
  requirePermission('event_bookings', 'edit'),
  updateTemplate
);

router.post(
  '/event-bookings/:id/send-email',
  verifyAdminToken,
  requirePermission('event_bookings', 'edit'),
  sendEventEmail
);

router.post(
  '/event-bookings/:id/send-whatsapp',
  verifyAdminToken,
  requirePermission('event_bookings', 'edit'),
  sendEventWhatsApp
);

module.exports = router;
