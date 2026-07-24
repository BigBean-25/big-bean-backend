const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/outletHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { outletHeroUpload } = require('../config/multer');

router.get('/active', ctrl.getActive);

router.get('/', verifyAdminToken, requirePermission('outlet_hero', 'view'), ctrl.getAll);
router.get('/:id', verifyAdminToken, requirePermission('outlet_hero', 'view'), ctrl.getById);
router.post('/', verifyAdminToken, requirePermission('outlet_hero', 'create'), outletHeroUpload.single('image'), ctrl.create);
router.put('/:id', verifyAdminToken, requirePermission('outlet_hero', 'edit'), outletHeroUpload.single('image'), ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('outlet_hero', 'delete'), ctrl.remove);

module.exports = router;
