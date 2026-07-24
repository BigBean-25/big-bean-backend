const express = require('express');
const router = express.Router();
const {
  getAllOutlets,
  getOutletById,
  getOutletBySlug,
  createOutlet,
  updateOutlet,
  deleteOutlet,
  toggleOutletStatus,
  getActiveOutlets
} = require('../controllers/outletController');
const { outletUpload } = require('../config/multer');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

// Multer wrapper: catches multer errors and returns clean JSON
// so they never bubble up as raw Express errors
const withOutletUpload = (handler) => (req, res, next) => {
  outletUpload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Outlet upload error:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    handler(req, res, next);
  });
};

// Get all outlets with optional filters
router.get('/', getAllOutlets);

// Get active outlets for public display
router.get('/active', getActiveOutlets);

// Get outlet by slug (for public pages)
router.get('/slug/:slug', getOutletBySlug);

// Get outlet by ID
router.get('/:id', getOutletById);

// Create new outlet (multipart/form-data with optional image)
router.post('/', verifyAdminToken, requirePermission('outlets', 'create'), withOutletUpload(createOutlet));

// Update outlet (multipart/form-data with optional image)
router.put('/:id', verifyAdminToken, requirePermission('outlets', 'edit'), withOutletUpload(updateOutlet));

// Delete outlet
router.delete('/:id', verifyAdminToken, requirePermission('outlets', 'delete'), deleteOutlet);

// Toggle outlet status
router.patch('/:id/status', verifyAdminToken, requirePermission('outlets', 'edit'), toggleOutletStatus);

module.exports = router;
