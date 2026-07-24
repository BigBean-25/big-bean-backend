const express = require('express');
const router = express.Router();
const { getAll, getActive, getById, create, update, deleteJob } = require('../controllers/careerJobController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.get('/active', getActive);
router.get('/', verifyAdminToken, requirePermission('career_jobs', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('career_jobs', 'view'), getById);
router.post('/', verifyAdminToken, requirePermission('career_jobs', 'create'), create);
router.put('/:id', verifyAdminToken, requirePermission('career_jobs', 'edit'), update);
router.delete('/:id', verifyAdminToken, requirePermission('career_jobs', 'delete'), deleteJob);

module.exports = router;
