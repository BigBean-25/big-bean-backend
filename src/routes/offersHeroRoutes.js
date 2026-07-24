const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, remove } = require('../controllers/offersHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { offersHeroUpload } = require('../config/multer');

router.get('/', getAll);
router.get('/active', getActive);
router.get('/:id', getById);
router.post('/', verifyAdminToken, requirePermission('offers_hero', 'create'), offersHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('offers_hero', 'edit'), offersHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('offers_hero', 'delete'), remove);

module.exports = router;
