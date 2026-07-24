const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/blogHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { blogHeroUpload } = require('../config/multer');

router.get('/', verifyAdminToken, requirePermission('blog_hero', 'view'), getAll);
router.get('/active', getActive);
router.get('/:id', verifyAdminToken, requirePermission('blog_hero', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('blog_hero', 'create'), blogHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('blog_hero', 'edit'), blogHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('blog_hero', 'delete'), deleteBanner);

module.exports = router;
