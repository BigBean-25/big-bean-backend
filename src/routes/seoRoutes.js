const express = require('express');
const router = express.Router();
const {
  getAllSeoSettings,
  getSeoSettingByPage,
  upsertSeoSetting,
  deleteSeoSetting,
  getSitemapData,
  getRobotsTxt
} = require('../controllers/seoController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all SEO settings with optional filters
router.get('/', getAllSeoSettings);

// Get sitemap data
router.get('/sitemap', getSitemapData);

// Get robots.txt content
router.get('/robots.txt', getRobotsTxt);

// Get SEO setting by page
router.get('/:page', getSeoSettingByPage);

// Create or update SEO setting
router.put('/:page', verifyAdminToken, requirePermission('seo', 'edit'), upsertSeoSetting);

// Delete SEO setting
router.delete('/:page', verifyAdminToken, requirePermission('seo', 'delete'), deleteSeoSetting);

module.exports = router;
