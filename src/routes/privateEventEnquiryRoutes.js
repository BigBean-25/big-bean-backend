const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { createEnquiry } = require('../controllers/privateEventEnquiryController');

// Tighter limit for the public lead form (on top of the global /api limiter)
const enquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many enquiries sent. Please try again later.' },
});

// Public lead submission
router.post('/', enquiryLimiter, createEnquiry);

module.exports = router;
