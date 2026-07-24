const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminSupportController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');

router.use(verifyAdminToken);

// Get all tickets - requires support_tickets.view
router.get('/tickets', requirePermission('support_tickets', 'view'), ctrl.getTickets);

// Get ticket by ID - requires support_tickets.view
router.get('/tickets/:id', requirePermission('support_tickets', 'view'), ctrl.getTicketById);

// Update ticket status - requires support_tickets.edit
router.put('/tickets/:id/status', requirePermission('support_tickets', 'edit'), ctrl.updateStatus);

// Reply to ticket - requires support_tickets.edit
router.post('/tickets/:id/reply', requirePermission('support_tickets', 'edit'), ctrl.reply);

module.exports = router;
