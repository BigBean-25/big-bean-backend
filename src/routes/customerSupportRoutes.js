const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerSupportController');
const { customerAuth } = require('../middleware/customerAuthMiddleware');

router.use(customerAuth);

router.get('/tickets',           ctrl.getTickets);
router.post('/tickets',          ctrl.createTicket);
router.get('/tickets/:id',       ctrl.getTicketById);
router.post('/tickets/:id/messages', ctrl.addMessage);

module.exports = router;
