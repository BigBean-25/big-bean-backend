const express = require('express');
const router = express.Router();
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const {
  getPublic, getAll, getGroup, updateSettings,
  testMail, testSms, testPayment, getLogs, backup,
} = require('../controllers/siteSettingsController');

router.get('/public', getPublic);

router.use(verifyAdminToken, requirePermission('site_settings', 'view'));

router.get('/logs',          getLogs);
router.get('/group/:group',  getGroup);
router.get('/',              getAll);
router.put('/',              updateSettings);
router.post('/test-mail',    testMail);
router.post('/test-sms',     testSms);
router.post('/test-payment', testPayment);
router.post('/backup',       backup);

module.exports = router;
