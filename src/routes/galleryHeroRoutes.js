const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/galleryHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { galleryHeroUpload } = require('../config/multer');

router.get('/', getAll);
router.get('/active', getActive);
router.get('/:id', getById);
router.post('/', verifyAdminToken, requirePermission('gallery_hero', 'create'), galleryHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('gallery_hero', 'edit'), galleryHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('gallery_hero', 'delete'), deleteBanner);

module.exports = router;
