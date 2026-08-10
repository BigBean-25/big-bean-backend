const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aboutFounderController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { aboutFounderUpload } = require('../config/multer');

// Public — active founders only (used by frontend About page)
router.get('/active', ctrl.getActive);

// Protected — admin CRUD
router.get('/', verifyAdminToken, requirePermission('about_founders', 'view'), ctrl.getAll);
router.get('/:id', verifyAdminToken, requirePermission('about_founders', 'view'), ctrl.getById);
router.post('/', verifyAdminToken, requirePermission('about_founders', 'create'), aboutFounderUpload.single('image'), ctrl.create);
router.put('/:id', verifyAdminToken, requirePermission('about_founders', 'edit'), aboutFounderUpload.single('image'), ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('about_founders', 'delete'), ctrl.remove);

module.exports = router;
