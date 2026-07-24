const express = require('express');
const router = express.Router();
const {
  createContactEnquiry,
  getAllContactEnquiries,
  getContactEnquiryById,
  updateContactEnquiry,
  updateStatus,
  sendEmail,
  sendWhatsApp,
  getCommLogs,
  deleteContactEnquiry
} = require('../controllers/contactEnquiryController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Public route for creating contact enquiries
router.post('/', createContactEnquiry);

// Protected routes for admin
router.get('/', verifyAdminToken, requirePermission('contact_enquiries', 'view'), getAllContactEnquiries);
router.get('/:id', verifyAdminToken, requirePermission('contact_enquiries', 'view'), getContactEnquiryById);
router.put('/:id', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), updateContactEnquiry);
router.put('/:id/status', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), updateStatus);
router.post('/:id/send-email', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), sendEmail);
router.post('/:id/send-whatsapp', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), sendWhatsApp);
router.get('/:id/logs', verifyAdminToken, requirePermission('contact_enquiries', 'view'), getCommLogs);
router.delete('/:id', verifyAdminToken, requirePermission('contact_enquiries', 'delete'), deleteContactEnquiry);

module.exports = router;
