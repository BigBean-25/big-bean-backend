const express = require('express');
const router = express.Router();
const { getActive, getAll, sync, updateStatus, deleteMedia } = require('../controllers/instagramMediaController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/active', getActive);
router.get('/', verifyAdminToken, requirePermission('instagram_media', 'view'), getAll);
router.post('/sync', verifyAdminToken, requirePermission('instagram_media', 'create'), sync);
router.put('/:id/status', verifyAdminToken, requirePermission('instagram_media', 'edit'), updateStatus);
router.delete('/:id', verifyAdminToken, requirePermission('instagram_media', 'delete'), deleteMedia);

module.exports = router;
