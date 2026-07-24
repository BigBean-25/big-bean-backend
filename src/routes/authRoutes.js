const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Login
router.post('/login', authController.login);

// Get current user profile (protected)
router.get('/profile', authenticateToken, authController.getProfile);

// Update profile (protected)
router.put('/profile', authenticateToken, authController.updateProfile);

// Change password (protected)
router.put('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
