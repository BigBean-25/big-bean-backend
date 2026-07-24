const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/reservationHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { reservationHeroUpload } = require('../config/multer');

router.get('/', getAll);
router.get('/active', getActive);
router.get('/:id', getById);
router.post('/', verifyAdminToken, requirePermission('reservation_hero', 'create'), reservationHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('reservation_hero', 'edit'), reservationHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('reservation_hero', 'delete'), deleteBanner);

module.exports = router;
