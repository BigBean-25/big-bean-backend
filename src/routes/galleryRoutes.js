const express = require('express');
const router = express.Router();
const {
  getAllGalleryItems,
  getGalleryItemById,
  getActiveGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  toggleGalleryItemStatus,
  getGalleryCategories,
  getGalleryStats
} = require('../controllers/galleryController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Get all gallery items with optional filters
router.get('/', getAllGalleryItems);

// Get gallery statistics
router.get('/stats', getGalleryStats);

// Get gallery categories
router.get('/categories', getGalleryCategories);

// Get active gallery items for public display
router.get('/active', getActiveGalleryItems);

// Get gallery item by ID
router.get('/:id', getGalleryItemById);

// Create new gallery item
router.post('/', verifyAdminToken, requirePermission('gallery', 'create'), createGalleryItem);

// Update gallery item
router.put('/:id', verifyAdminToken, requirePermission('gallery', 'edit'), updateGalleryItem);

// Delete gallery item
router.delete('/:id', verifyAdminToken, requirePermission('gallery', 'delete'), deleteGalleryItem);

// Toggle gallery item status
router.patch('/:id/status', verifyAdminToken, requirePermission('gallery', 'edit'), toggleGalleryItemStatus);

module.exports = router;
