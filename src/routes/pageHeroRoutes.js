const express = require('express');
const router = express.Router();
const { getByPageKey } = require('../controllers/pageHeroController');

router.get('/:pageKey', getByPageKey);

module.exports = router;
