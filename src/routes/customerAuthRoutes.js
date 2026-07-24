const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerAuthController');
const { customerAuth } = require('../middleware/customerAuthMiddleware');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/me', customerAuth, ctrl.me);
router.put('/profile', customerAuth, ctrl.updateProfile);
router.put('/change-password', customerAuth, ctrl.changePassword);

module.exports = router;
