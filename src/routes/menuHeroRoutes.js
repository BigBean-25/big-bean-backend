const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/menuHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { menuHeroUpload } = require('../config/multer');

router.get('/active', ctrl.getActive);

router.get('/', verifyAdminToken, requirePermission('menu_hero', 'view'), ctrl.getAll);
router.get('/:id', verifyAdminToken, requirePermission('menu_hero', 'view'), ctrl.getById);
router.post('/', verifyAdminToken, requirePermission('menu_hero', 'create'), menuHeroUpload.single('image'), ctrl.create);
router.put('/:id', verifyAdminToken, requirePermission('menu_hero', 'edit'), menuHeroUpload.single('image'), ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('menu_hero', 'delete'), ctrl.remove);

module.exports = router;
