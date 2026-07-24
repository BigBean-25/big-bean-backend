const express = require('express');
const router = express.Router();
const {
  getAllBlogPosts,
  getBlogPostById,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getPublishedBlogPosts,
  getBlogCategories,
  toggleBlogPostStatus
} = require('../controllers/blogController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all blog posts with optional filters (admin)
router.get('/', getAllBlogPosts);

// Get published blog posts for public display
router.get('/published', getPublishedBlogPosts);

// Get blog categories
router.get('/categories', getBlogCategories);

// Get blog post by slug (for public pages)
router.get('/slug/:slug', getBlogPostBySlug);

// Get blog post by ID
router.get('/:id', getBlogPostById);

// Create new blog post
router.post('/', verifyAdminToken, requirePermission('blog_posts', 'create'), createBlogPost);

// Update blog post
router.put('/:id', verifyAdminToken, requirePermission('blog_posts', 'edit'), updateBlogPost);

// Delete blog post
router.delete('/:id', verifyAdminToken, requirePermission('blog_posts', 'delete'), deleteBlogPost);

// Toggle blog post status
router.patch('/:id/status', verifyAdminToken, requirePermission('blog_posts', 'edit'), toggleBlogPostStatus);

module.exports = router;
