const express = require('express');
const router = express.Router();
const {
  getAllTestimonials,
  getTestimonialById,
  getActiveTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialStatus,
  getTestimonialStats
} = require('../controllers/testimonialController');

// Get all testimonials with optional filters
router.get('/', getAllTestimonials);

// Get testimonial statistics
router.get('/stats', getTestimonialStats);

// Get active testimonials for public display
router.get('/active', getActiveTestimonials);

// Get testimonial by ID
router.get('/:id', getTestimonialById);

// Create new testimonial
router.post('/', createTestimonial);

// Update testimonial
router.put('/:id', updateTestimonial);

// Delete testimonial
router.delete('/:id', deleteTestimonial);

// Toggle testimonial status
router.patch('/:id/status', toggleTestimonialStatus);

module.exports = router;
