const express = require('express');
const router = express.Router();
const { getAll, getPublished, getFeatured, getBySlug, getById, create, update, deletePost } = require('../controllers/blogPostController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { blogPostUpload } = require('../config/multer');

router.get('/published', getPublished);
router.get('/featured', getFeatured);
router.get('/slug/:slug', getBySlug);
router.get('/', verifyAdminToken, requirePermission('blog_posts', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('blog_posts', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('blog_posts', 'create'), blogPostUpload.single('featured_image'), create);
router.put('/:id', verifyAdminToken, requirePermission('blog_posts', 'edit'), blogPostUpload.single('featured_image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('blog_posts', 'delete'), deletePost);

module.exports = router;
