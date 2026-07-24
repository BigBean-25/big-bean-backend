const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/franchiseHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { franchiseHeroUpload } = require('../config/multer');

router.get('/active', getActive);
router.get('/', verifyAdminToken, requirePermission('franchise_hero', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('franchise_hero', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('franchise_hero', 'create'), franchiseHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('franchise_hero', 'edit'), franchiseHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('franchise_hero', 'delete'), deleteBanner);

module.exports = router;
