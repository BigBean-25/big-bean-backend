const express = require('express');
const router = express.Router();
const { merchandiseUpload } = require('../config/multer');
const {
  getAllMerchandise,
  getMerchandiseById,
  getMerchandiseBySlug,
  getActiveMerchandise,
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
} = require('../controllers/merchandiseController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/active', getActiveMerchandise);
router.get('/slug/:slug', getMerchandiseBySlug);
router.get('/', getAllMerchandise);
router.get('/:id', getMerchandiseById);
router.post('/', verifyAdminToken, requirePermission('merchandise', 'create'), merchandiseUpload.single('image'), createMerchandise);
router.put('/:id', verifyAdminToken, requirePermission('merchandise', 'edit'), merchandiseUpload.single('image'), updateMerchandise);
router.delete('/:id', verifyAdminToken, requirePermission('merchandise', 'delete'), deleteMerchandise);

module.exports = router;
