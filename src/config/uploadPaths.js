const path = require('path');
const fs = require('fs');

// ── Persistent upload root ────────────────────────────────────────────────────
// Set UPLOAD_ROOT in production to a directory OUTSIDE the Git working tree.
// On Hostinger this must be a path that survives git deployments, e.g.:
//   UPLOAD_ROOT=/home/<username>/bigbean-uploads
// Locally defaults to backend/src/uploads (existing behaviour, no change needed).

const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, '../uploads');

if (process.env.NODE_ENV === 'production' && !process.env.UPLOAD_ROOT) {
  console.error(
    '[UPLOAD_ROOT] WARNING: UPLOAD_ROOT is not set in production.\n' +
    '  Uploaded files are being stored inside the deployment directory and WILL be\n' +
    '  lost after the next git deployment.\n' +
    '  Set UPLOAD_ROOT to a persistent directory outside the Git working tree.'
  );
}

// ── Allowed modules for this helper ──────────────────────────────────────────
// All runtime upload modules. Supports nested paths like 'careers/resumes'.
const MANAGED_MODULES = new Set([
  // Previously managed
  'menu-hero', 'events', 'offers', 'contact-hero', 'website-popups',
  // Home banner media (shared image/video folders)
  'images', 'videos',
  // Hero banners
  'outlet-hero', 'offers-hero', 'gallery-hero', 'career-hero', 'events-hero',
  'franchise-hero', 'corporate-hero', 'page-heroes', 'about-hero',
  'reservation-hero', 'blog-hero',
  // Content modules
  'merchandise-banners', 'legal-pages', 'blog', 'app-promos',
  // Gallery
  'gallery',
  // Merchandise
  'merchandise', 'merchandise-categories',
  // Other
  'outlets', 'menu-combos',
  // Nested
  'careers/resumes',
  // SEO
  'seo',
]);

// ── getUploadDir(module) ──────────────────────────────────────────────────────
// Returns the absolute filesystem path for a module's upload directory and
// creates it if it does not already exist. Supports nested paths e.g. 'careers/resumes'.
const getUploadDir = (module) => {
  if (!MANAGED_MODULES.has(module)) {
    throw new Error(`[uploadPaths] getUploadDir: unknown module "${module}". Allowed: ${[...MANAGED_MODULES].join(', ')}`);
  }
  const dir = path.join(UPLOAD_ROOT, module);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// ── resolveUploadFile(dbPath) ─────────────────────────────────────────────────
// Converts a DB-stored relative path like "uploads/events/file.jpg" to the
// absolute filesystem path under UPLOAD_ROOT, e.g. "/persistent/events/file.jpg".
// Returns null for HTTP/HTTPS URLs, null/empty input, or any path-traversal attempt.
// Supports nested modules like 'careers/resumes' via progressive module matching.
const resolveUploadFile = (dbPath) => {
  if (!dbPath || typeof dbPath !== 'string') return null;
  if (dbPath.startsWith('http://') || dbPath.startsWith('https://')) return null;

  const normalized = dbPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // Guard against path traversal
  if (normalized.includes('..')) return null;

  // Expected: "uploads/<module>/<filename>" where module may be nested (e.g. 'careers/resumes')
  const parts = normalized.split('/');
  if (parts.length < 3 || parts[0] !== 'uploads') return null;

  // Try progressively longer module paths to support nested modules
  let module = null;
  let filenameStartIdx = 0;
  for (let depth = 1; depth < parts.length; depth++) {
    const candidate = parts.slice(1, depth + 1).join('/');
    if (MANAGED_MODULES.has(candidate)) {
      module = candidate;
      filenameStartIdx = depth + 1;
      break;
    }
  }
  if (!module) return null;

  const filename = parts.slice(filenameStartIdx).join('/');
  if (!filename || filename.includes('..') || filename.includes('/')) return null;

  return path.join(UPLOAD_ROOT, module, filename);
};

module.exports = { UPLOAD_ROOT, getUploadDir, resolveUploadFile };
