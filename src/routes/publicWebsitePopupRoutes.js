const express = require('express');
const router  = express.Router();
const { getActivePopup } = require('../controllers/websitePopupController');

router.get('/active', getActivePopup);

module.exports = router;
