const express = require('express');
const router = express.Router();
const { merchandiseBannerUpload } = require('../config/multer');
const {
  getAllBanners,
  getActiveBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/merchandiseBannerController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/active', getActiveBanners);
router.get('/', getAllBanners);
router.get('/:id', getBannerById);
router.post('/', verifyAdminToken, requirePermission('merchandise_banners', 'create'), merchandiseBannerUpload.single('image'), createBanner);
router.put('/:id', verifyAdminToken, requirePermission('merchandise_banners', 'edit'), merchandiseBannerUpload.single('image'), updateBanner);
router.delete('/:id', verifyAdminToken, requirePermission('merchandise_banners', 'delete'), deleteBanner);

module.exports = router;
