const express = require('express');
const router = express.Router();
const { appPromoUpload } = require('../config/multer');
const {
  getAllAppPromos,
  getActiveAppPromos,
  getAppPromoById,
  createAppPromo,
  updateAppPromo,
  deleteAppPromo
} = require('../controllers/appPromoController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

const imageFields = appPromoUpload.fields([
  { name: 'qr_image', maxCount: 1 },
  { name: 'mockup_image', maxCount: 1 },
  { name: 'background_image', maxCount: 1 }
]);

router.get('/', getAllAppPromos);
router.get('/active', getActiveAppPromos);
router.get('/:id', getAppPromoById);
router.post('/', verifyAdminToken, requirePermission('app_promos', 'create'), imageFields, createAppPromo);
router.put('/:id', verifyAdminToken, requirePermission('app_promos', 'edit'), imageFields, updateAppPromo);
router.delete('/:id', verifyAdminToken, requirePermission('app_promos', 'delete'), deleteAppPromo);

module.exports = router;
