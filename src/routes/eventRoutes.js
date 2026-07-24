const express = require('express');
const router = express.Router();
const { getActiveEvents, getEventBySlug, getEventOutlets } = require('../controllers/eventController');

// Public routes
// Important: /active and /outlets must be defined before /:slug to avoid being treated as a slug
router.get('/active', getActiveEvents);
router.get('/outlets', getEventOutlets);
router.get('/:slug', getEventBySlug);

module.exports = router;
