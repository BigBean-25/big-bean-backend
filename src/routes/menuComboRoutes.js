const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/menuComboController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { menuComboUpload } = require('../config/multer');

router.get('/active', ctrl.getActive);

router.get('/', verifyAdminToken, requirePermission('menu_combos', 'view'), ctrl.getAll);
router.get('/:id', verifyAdminToken, requirePermission('menu_combos', 'view'), ctrl.getById);
router.post('/', verifyAdminToken, requirePermission('menu_combos', 'create'), menuComboUpload.single('image'), ctrl.create);
router.put('/:id', verifyAdminToken, requirePermission('menu_combos', 'edit'), menuComboUpload.single('image'), ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('menu_combos', 'delete'), ctrl.remove);

module.exports = router;
