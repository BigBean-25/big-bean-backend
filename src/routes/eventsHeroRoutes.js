const express = require('express');
const router = express.Router();
const { getActive } = require('../controllers/eventsHeroController');

router.get('/active', getActive);

module.exports = router;
