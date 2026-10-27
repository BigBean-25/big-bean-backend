const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { privateEventsUpload } = require('../config/multer');
const {
  getHeroAll, createHero, updateHero, removeHero,
  getGalleryAll, createGalleryItem, updateGalleryItem, removeGalleryItem,
} = require('../controllers/privateEventsContentController');

const heroFiles = privateEventsUpload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mobile_image', maxCount: 1 },
]);

// Hero CMS
router.get('/hero', verifyAdminToken, requirePermission('private_events', 'view'), getHeroAll);
router.post('/hero', verifyAdminToken, requirePermission('private_events', 'create'), heroFiles, createHero);
router.put('/hero/:id', verifyAdminToken, requirePermission('private_events', 'edit'), heroFiles, updateHero);
router.delete('/hero/:id', verifyAdminToken, requirePermission('private_events', 'delete'), removeHero);

// Gallery CMS
router.get('/gallery', verifyAdminToken, requirePermission('private_events', 'view'), getGalleryAll);
router.post('/gallery', verifyAdminToken, requirePermission('private_events', 'create'), privateEventsUpload.single('image'), createGalleryItem);
router.put('/gallery/:id', verifyAdminToken, requirePermission('private_events', 'edit'), privateEventsUpload.single('image'), updateGalleryItem);
router.delete('/gallery/:id', verifyAdminToken, requirePermission('private_events', 'delete'), removeGalleryItem);

module.exports = router;
