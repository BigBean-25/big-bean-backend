const express = require('express');
const router = express.Router();
const {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  updateMultipleSettings,
  getPublicSettings,
  resetSetting,
  exportSettings
} = require('../controllers/settingController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Apply admin authentication to all routes except public
router.use((req, res, next) => {
  if (req.path === '/public') {
    return next();
  }
  return verifyAdminToken(req, res, next);
});

// Get all settings grouped by category - requires settings.view
router.get('/', requirePermission('settings', 'view'), getAllSettings);

// Get public settings for frontend (no auth required)
router.get('/public', getPublicSettings);

// Export settings - requires settings.export
router.get('/export', requirePermission('settings', 'export'), exportSettings);

// Get setting by key - requires settings.view
router.get('/:key', requirePermission('settings', 'view'), getSettingByKey);

// Update setting by key - requires settings.edit
router.put('/:key', requirePermission('settings', 'edit'), updateSetting);

// Update multiple settings - requires settings.edit
router.put('/', requirePermission('settings', 'edit'), updateMultipleSettings);

// Reset setting to default value - requires settings.edit
router.post('/:key/reset', requirePermission('settings', 'edit'), resetSetting);

module.exports = router;
