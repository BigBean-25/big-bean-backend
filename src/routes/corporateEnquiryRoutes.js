const express = require('express');
const router = express.Router();
const { submit, getAll, getById, updateStatus, sendEmail, sendWhatsApp, getCommLogs, deleteEnquiry } = require('../controllers/corporateEnquiryController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Public submission route (no auth)
router.post('/', submit);

// Admin-only routes below
router.get('/', verifyAdminToken, requirePermission('corporate_enquiries', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('corporate_enquiries', 'view'), getById);
router.put('/:id/status', verifyAdminToken, requirePermission('corporate_enquiries', 'edit'), updateStatus);
router.post('/:id/send-email', verifyAdminToken, requirePermission('corporate_enquiries', 'edit'), sendEmail);
router.post('/:id/send-whatsapp', verifyAdminToken, requirePermission('corporate_enquiries', 'edit'), sendWhatsApp);
router.get('/:id/logs', verifyAdminToken, requirePermission('corporate_enquiries', 'view'), getCommLogs);
router.delete('/:id', verifyAdminToken, requirePermission('corporate_enquiries', 'delete'), deleteEnquiry);

module.exports = router;
