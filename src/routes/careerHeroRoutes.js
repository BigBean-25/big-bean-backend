const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteBanner } = require('../controllers/careerHeroController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { careerHeroUpload } = require('../config/multer');

router.get('/active', getActive);
router.get('/', verifyAdminToken, requirePermission('career_hero', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('career_hero', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('career_hero', 'create'), careerHeroUpload.single('image'), create);
router.put('/:id', verifyAdminToken, requirePermission('career_hero', 'edit'), careerHeroUpload.single('image'), update);
router.delete('/:id', verifyAdminToken, requirePermission('career_hero', 'delete'), deleteBanner);

module.exports = router;
