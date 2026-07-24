const express = require('express');
const router = express.Router();
const {
  getAllFranchiseEnquiries,
  getFranchiseEnquiryById,
  createFranchiseEnquiry,
  updateFranchiseEnquiryStatus,
  deleteFranchiseEnquiry,
  getFranchiseEnquiryStats,
  getFranchiseFollowUps
} = require('../controllers/franchiseController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all franchise enquiries with optional filters
router.get('/', getAllFranchiseEnquiries);

// Get franchise enquiry statistics
router.get('/stats', getFranchiseEnquiryStats);

// Get franchise enquiry follow-ups
router.get('/follow-ups', getFranchiseFollowUps);

// Get franchise enquiry by ID
router.get('/:id', getFranchiseEnquiryById);

// Create new franchise enquiry
router.post('/', createFranchiseEnquiry);

// Update franchise enquiry status
router.patch('/:id/status', verifyAdminToken, requirePermission('franchise_enquiries', 'edit'), updateFranchiseEnquiryStatus);

// Delete franchise enquiry
router.delete('/:id', verifyAdminToken, requirePermission('franchise_enquiries', 'delete'), deleteFranchiseEnquiry);

module.exports = router;
