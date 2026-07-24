
const express = require('express');
const router  = express.Router();
const ctrl         = require('../controllers/seoPagesController');
const settingsCtrl = require('../controllers/seoSettingsController');
const { verifyAdminToken, requirePermission } = require('../middleware/authMiddleware');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'seo');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `seo-${Date.now()}-${Math.round(Math.random()*1e5)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
const imgFields = upload.fields([{ name: 'og_image', maxCount: 1 }, { name: 'twitter_image', maxCount: 1 }]);

// ── Settings ─────────────────────────────────────────────────
router.get('/settings/public', settingsCtrl.getPublicSettings);
router.get('/settings',     verifyAdminToken, requirePermission('seo_pages', 'view'), settingsCtrl.getSettings);
router.put('/settings',     verifyAdminToken, requirePermission('seo_pages', 'edit'), settingsCtrl.updateSettings);

// ── Public ──────────────────────────────────────────────────
router.get('/page/:pageKey', ctrl.getByKey);
router.get('/by-path',       ctrl.getByPath);

// ── Admin ───────────────────────────────────────────────────
router.get('/',     verifyAdminToken, requirePermission('seo_pages', 'view'), ctrl.getAll);
router.get('/:id',  verifyAdminToken, requirePermission('seo_pages', 'view'), ctrl.getById);
router.post('/',    verifyAdminToken, requirePermission('seo_pages', 'create'), imgFields, ctrl.create);
router.put('/:id',  verifyAdminToken, requirePermission('seo_pages', 'edit'), imgFields, ctrl.update);
router.delete('/:id', verifyAdminToken, requirePermission('seo_pages', 'delete'), ctrl.remove);

module.exports = router;
