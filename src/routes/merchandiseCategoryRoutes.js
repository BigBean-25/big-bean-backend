const express = require('express');
const router = express.Router();
const { merchandiseCategoryUpload } = require('../config/multer');
const {
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/merchandiseCategoryController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/active', getActiveCategories);
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.post('/', verifyAdminToken, requirePermission('merchandise_categories', 'create'), merchandiseCategoryUpload.single('image'), createCategory);
router.put('/:id', verifyAdminToken, requirePermission('merchandise_categories', 'edit'), merchandiseCategoryUpload.single('image'), updateCategory);
router.delete('/:id', verifyAdminToken, requirePermission('merchandise_categories', 'delete'), deleteCategory);

module.exports = router;
