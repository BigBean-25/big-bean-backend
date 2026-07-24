const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, remove } = require('../controllers/contactHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { contactHeroUpload } = require('../config/multer');

router.get('/', getAll);
router.get('/active', getActive);
router.get('/:id', getById);
router.post('/', verifyAdminToken, requirePermission('contact_hero', 'create'), contactHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('contact_hero', 'edit'), contactHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('contact_hero', 'delete'), remove);

module.exports = router;
