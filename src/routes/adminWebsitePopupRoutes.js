const express = require('express');
const router  = express.Router();
const { popupUpload } = require('../config/multer');
const {
  getAllPopups, getPopupById,
  createPopup, updatePopup,
  togglePopupStatus, deletePopup
} = require('../controllers/websitePopupController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

const imageFields = popupUpload.fields([
  { name: 'desktop_image', maxCount: 1 },
  { name: 'mobile_image',  maxCount: 1 }
]);

router.get(   '/',            verifyAdminToken, requirePermission('website_popups', 'view'),   getAllPopups);
router.get(   '/:id',         verifyAdminToken, requirePermission('website_popups', 'view'),   getPopupById);
router.post(  '/',            verifyAdminToken, requirePermission('website_popups', 'create'), imageFields, createPopup);
router.put(   '/:id',         verifyAdminToken, requirePermission('website_popups', 'edit'),   imageFields, updatePopup);
router.patch( '/:id/status',  verifyAdminToken, requirePermission('website_popups', 'edit'),   togglePopupStatus);
router.delete('/:id',         verifyAdminToken, requirePermission('website_popups', 'delete'), deletePopup);

module.exports = router;
