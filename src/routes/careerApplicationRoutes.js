const express = require('express');
const router = express.Router();
const { submit, getAll, getById, updateStatus, sendEmail, sendWhatsApp, getCommLogs, deleteApplication } = require('../controllers/careerApplicationController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const { careerResumeUpload } = require('../config/multer');

// Wrap multer so file-type/size errors return JSON (not Express error HTML)
const resumeUploadMiddleware = (req, res, next) => {
  careerResumeUpload.single('resume')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error. Only PDF, DOC, DOCX (max 5MB) are allowed.'
      });
    }
    next();
  });
};

// Public submission route (no auth)
router.post('/', resumeUploadMiddleware, submit);

// Admin-only routes below
router.get('/', verifyAdminToken, requirePermission('career_applications', 'view'), getAll);
router.get('/:id', verifyAdminToken, requirePermission('career_applications', 'view'), getById);
router.put('/:id/status', verifyAdminToken, requirePermission('career_applications', 'edit'), updateStatus);
router.post('/:id/send-email', verifyAdminToken, requirePermission('career_applications', 'edit'), sendEmail);
router.post('/:id/send-whatsapp', verifyAdminToken, requirePermission('career_applications', 'edit'), sendWhatsApp);
router.get('/:id/logs', verifyAdminToken, requirePermission('career_applications', 'view'), getCommLogs);
router.delete('/:id', verifyAdminToken, requirePermission('career_applications', 'delete'), deleteApplication);

module.exports = router;
