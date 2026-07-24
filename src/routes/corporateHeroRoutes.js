const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/corporateHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { corporateHeroUpload } = require('../config/multer');

router.get('/active', getActive);
router.get('/', verifyAdminToken, requirePermission('corporate_hero', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('corporate_hero', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('corporate_hero', 'create'), corporateHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('corporate_hero', 'edit'), corporateHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('corporate_hero', 'delete'), deleteBanner);

module.exports = router;
