const express = require('express');
const router = express.Router();
const { getAll, getByPageKeyAdmin, updateByPageKey } = require('../controllers/pageHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { pageHeroUpload } = require('../config/multer');

router.get('/', verifyAdminToken, requirePermission('site_settings', 'view'), getAll);
router.get('/:pageKey', verifyAdminToken, requirePermission('site_settings', 'view'), getByPageKeyAdmin);
router.put('/:pageKey', verifyAdminToken, requirePermission('site_settings', 'edit'), pageHeroUpload.fields([{ name: 'hero_image', maxCount: 1 }, { name: 'mobile_hero_image', maxCount: 1 }]), updateByPageKey);

module.exports = router;
