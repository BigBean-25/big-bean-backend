const express = require('express');
const router = express.Router();
const { getLegalPages, getLegalPageByType, getLegalPageById, createLegalPage, updateLegalPage, deleteLegalPage } = require('../controllers/legalPageController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { legalPageUpload } = require('../config/multer');

router.get('/type/:pageType', getLegalPageByType);
router.get('/', verifyAdminToken, requirePermission('legal_pages', 'view'), getLegalPages);
router.get('/:id', verifyAdminToken, requirePermission('legal_pages', 'view'), getLegalPageById);
router.post('/', verifyAdminToken, requirePermission('legal_pages', 'create'), legalPageUpload.single('hero_image'), createLegalPage);
router.put('/:id', verifyAdminToken, requirePermission('legal_pages', 'edit'), legalPageUpload.single('hero_image'), updateLegalPage);
router.delete('/:id', verifyAdminToken, requirePermission('legal_pages', 'delete'), deleteLegalPage);

module.exports = router;
