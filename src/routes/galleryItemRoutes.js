const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteItem } = require('../controllers/galleryItemController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { galleryItemUpload } = require('../config/multer');

router.get('/', getAll);
router.get('/active', getActive);
router.get('/:id', getById);
router.post('/', verifyAdminToken, requirePermission('gallery', 'create'), galleryItemUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), create);
router.put('/:id', verifyAdminToken, requirePermission('gallery', 'edit'), galleryItemUpload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), update);
router.delete('/:id', verifyAdminToken, requirePermission('gallery', 'delete'), deleteItem);

module.exports = router;
