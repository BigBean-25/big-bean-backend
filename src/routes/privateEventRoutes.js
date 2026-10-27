const express = require('express');
const router = express.Router();
const { getPublicContent } = require('../controllers/privateEventsContentController');

// Public: hero + gallery for /private-events
router.get('/content', getPublicContent);

module.exports = router;
