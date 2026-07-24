const express = require('express');
const router = express.Router();
const { getAll, getById, create, update, remove } = require('../controllers/eventsHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { eventsHeroUpload } = require('../config/multer');

router.get('/', verifyAdminToken, requirePermission('events', 'view'), getAll);
router.post('/', verifyAdminToken, requirePermission('events', 'create'), eventsHeroUpload.single('image'), create);
router.get('/:id', verifyAdminToken, requirePermission('events', 'view'), getById);
router.put('/:id', verifyAdminToken, requirePermission('events', 'edit'), eventsHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('events', 'delete'), remove);

module.exports = router;
