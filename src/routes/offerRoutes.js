const express = require('express');
const router = express.Router();
const { offerUpload } = require('../config/multer');
const {
  getAllOffers,
  getActiveOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer
} = require('../controllers/offerController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/', getAllOffers);
router.get('/active', getActiveOffers);
router.get('/:id', getOfferById);
router.post('/', verifyAdminToken, requirePermission('offers', 'create'), offerUpload.single('image'), createOffer);
router.put('/:id', verifyAdminToken, requirePermission('offers', 'edit'), offerUpload.single('image'), updateOffer);
router.delete('/:id', verifyAdminToken, requirePermission('offers', 'delete'), deleteOffer);

module.exports = router;
