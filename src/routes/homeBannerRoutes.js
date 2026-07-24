const express = require('express');
const router = express.Router();
const homeBannerController = require('../controllers/homeBannerController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { upload } = require('../config/multer');

// Public routes
router.get('/active', homeBannerController.getActiveBanners);

// Admin routes (protected)
router.get('/', verifyAdminToken, requirePermission('home_banners', 'view'), homeBannerController.getAllBanners);
router.get('/:id', verifyAdminToken, requirePermission('home_banners', 'view'), homeBannerController.getBannerById);
router.post('/', verifyAdminToken, requirePermission('home_banners', 'create'), upload.fields([
  { name: 'desktop_media', maxCount: 1 },
  { name: 'mobile_media', maxCount: 1 },
  { name: 'fallback_image', maxCount: 1 }
]), homeBannerController.createBanner);
router.put('/:id', verifyAdminToken, requirePermission('home_banners', 'edit'), upload.fields([
  { name: 'desktop_media', maxCount: 1 },
  { name: 'mobile_media', maxCount: 1 },
  { name: 'fallback_image', maxCount: 1 }
]), homeBannerController.updateBanner);
router.delete('/:id', verifyAdminToken, requirePermission('home_banners', 'delete'), homeBannerController.deleteBanner);
router.patch('/:id/status', verifyAdminToken, requirePermission('home_banners', 'edit'), homeBannerController.updateBannerStatus);

module.exports = router;
