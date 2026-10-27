const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const {
  getAllEnquiries, getEnquiryById, updateEnquiry, updateStatus, deleteEnquiry, sendEmail,
} = require('../controllers/privateEventEnquiryController');

router.get('/', verifyAdminToken, requirePermission('private_event_enquiries', 'view'), getAllEnquiries);
router.get('/:id', verifyAdminToken, requirePermission('private_event_enquiries', 'view'), getEnquiryById);
router.put('/:id', verifyAdminToken, requirePermission('private_event_enquiries', 'edit'), updateEnquiry);
router.put('/:id/status', verifyAdminToken, requirePermission('private_event_enquiries', 'edit'), updateStatus);
router.post('/:id/send-email', verifyAdminToken, requirePermission('private_event_enquiries', 'edit'), sendEmail);
router.delete('/:id', verifyAdminToken, requirePermission('private_event_enquiries', 'delete'), deleteEnquiry);

module.exports = router;
