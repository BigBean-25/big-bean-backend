const express = require('express');
const router = express.Router();
const {
  getAllContactEnquiries,
  getContactEnquiryById,
  createContactEnquiry,
  updateContactEnquiryStatus,
  deleteContactEnquiry,
  getContactEnquiryStats,
  bulkUpdateContactEnquiries
} = require('../controllers/contactController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all contact enquiries with optional filters
router.get('/', getAllContactEnquiries);

// Get contact enquiry statistics
router.get('/stats', getContactEnquiryStats);

// Get contact enquiry by ID
router.get('/:id', getContactEnquiryById);

// Create new contact enquiry
router.post('/', createContactEnquiry);

// Update contact enquiry status
router.patch('/:id/status', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), updateContactEnquiryStatus);

// Bulk update contact enquiries
router.patch('/bulk-update', verifyAdminToken, requirePermission('contact_enquiries', 'edit'), bulkUpdateContactEnquiries);

// Delete contact enquiry
router.delete('/:id', verifyAdminToken, requirePermission('contact_enquiries', 'delete'), deleteContactEnquiry);

module.exports = router;
