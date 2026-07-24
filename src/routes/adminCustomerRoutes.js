const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminCustomerController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
// TODO: protect with admin auth middleware when available
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.get('/:id/login-logs', ctrl.getLogs);
router.put('/:id/status', verifyAdminToken, requirePermission('customers', 'edit'), ctrl.updateStatus);
router.delete('/:id', verifyAdminToken, requirePermission('customers', 'delete'), ctrl.deleteCustomer);
module.exports = router;
