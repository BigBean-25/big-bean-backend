const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/newsletterController')
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.post('/subscribe', ctrl.subscribe)
router.get('/subscribers', verifyAdminToken, requirePermission('newsletter_subscribers', 'view'), ctrl.getSubscribers)
router.put('/subscribers/:id/status', verifyAdminToken, requirePermission('newsletter_subscribers', 'edit'), ctrl.updateStatus)
router.delete('/subscribers/:id', verifyAdminToken, requirePermission('newsletter_subscribers', 'delete'), ctrl.deleteSubscriber)

module.exports = router
