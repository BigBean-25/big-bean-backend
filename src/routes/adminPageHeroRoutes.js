const express = require('express');
const router = express.Router();
const { getAll, getByPageKeyAdmin, updateByPageKey } = require('../controllers/pageHeroController');
const { verifyAdminToken } = require('../middleware/authMiddleware');
const { pageHeroUpload } = require('../config/multer');

router.get('/', verifyAdminToken, getAll);
router.get('/:pageKey', verifyAdminToken, getByPageKeyAdmin);
router.put('/:pageKey', verifyAdminToken, pageHeroUpload.fields([{ name: 'hero_image', maxCount: 1 }, { name: 'mobile_hero_image', maxCount: 1 }]), updateByPageKey);

module.exports = router;
