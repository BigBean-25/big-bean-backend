const express = require('express');
const router = express.Router();
const {
  getAllCareerApplications,
  getCareerApplicationById,
  createCareerApplication,
  updateCareerApplicationStatus,
  deleteCareerApplication,
  getCareerApplicationStats
} = require('../controllers/careerController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all career applications with optional filters
router.get('/', getAllCareerApplications);

// Get career application statistics
router.get('/stats', getCareerApplicationStats);

// Get career application by ID
router.get('/:id', getCareerApplicationById);

// Create new career application
router.post('/', createCareerApplication);

// Update career application status
router.patch('/:id/status', verifyAdminToken, requirePermission('career_jobs', 'edit'), updateCareerApplicationStatus);

// Delete career application
router.delete('/:id', verifyAdminToken, requirePermission('career_jobs', 'delete'), deleteCareerApplication);

module.exports = router;
