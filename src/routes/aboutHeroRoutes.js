const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aboutHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { aboutHeroUpload } = require('../config/multer');

// Public
router.get('/active', ctrl.getActive);

// Protected
router.get('/', verifyAdminToken, requirePermission('about_hero', 'view'), ctrl.getAll);
router.get('/:id', verifyAdminToken, requirePermission('about_hero', 'view'), ctrl.getById);
router.post('/', verifyAdminToken, requirePermission('about_hero', 'create'), aboutHeroUpload.single('image'), ctrl.create);
router.put('/:id', verifyAdminToken, requirePermission('about_hero', 'edit'), aboutHeroUpload.single('image'), ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('about_hero', 'delete'), ctrl.remove);

module.exports = router;
