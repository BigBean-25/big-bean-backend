const { executeQuery } = require('../config/database');
const { getUploadDir, resolveUploadFile } = require('../config/uploadPaths');
const fs = require('fs');
const path = require('path');

let tablesEnsured = false;

const ensureTables = async () => {
  if (tablesEnsured) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS private_events_hero (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(255) NULL,
      heading VARCHAR(255) NOT NULL,
      description TEXT NULL,
      supporting_text TEXT NULL,
      primary_cta_text VARCHAR(100) DEFAULT 'Enquire About Your Event',
      secondary_cta_text VARCHAR(100) DEFAULT 'Explore Outlet Locations',
      image VARCHAR(500) NULL,
      mobile_image VARCHAR(500) NULL,
      image_alt VARCHAR(255) NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS private_events_gallery (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image VARCHAR(500) NOT NULL,
      outlet_slug VARCHAR(120) NULL,
      outlet_name VARCHAR(255) NULL,
      caption VARCHAR(255) NULL,
      alt_text VARCHAR(255) NULL,
      sort_order INT DEFAULT 0,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Seed the permission rows once so the module appears under Roles & Permissions
  const perms = [
    ['private_events', 'Private Events Page'],
    ['private_event_enquiries', 'Private Event Enquiries'],
  ];
  for (const [key, name] of perms) {
    for (const action of ['view', 'create', 'edit', 'delete', 'export']) {
      const permKey = `${key}.${action}`;
      const permName = `${name} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      await executeQuery(
        `INSERT IGNORE INTO admin_permissions
          (module_key, module_name, permission_key, permission_name, permission_group, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [key, name, permKey, permName,
         key === 'private_events' ? 'website_content' : 'enquiries', 0]
      );
    }
  }
  const superRole = await executeQuery("SELECT id FROM admin_roles WHERE role_key = 'super_admin' LIMIT 1");
  if (superRole.length) {
    const permRows = await executeQuery(
      "SELECT id FROM admin_permissions WHERE module_key IN ('private_events','private_event_enquiries')"
    );
    for (const p of permRows) {
      await executeQuery(
        `INSERT IGNORE INTO admin_role_permissions
          (role_id, permission_id, can_view, can_create, can_edit, can_delete, can_export)
         VALUES (?, ?, 1, 1, 1, 1, 1)`,
        [superRole[0].id, p.id]
      );
    }
  }
  tablesEnsured = true;
};

// Deletes a stored "uploads/private-events/<file>" image from persistent
// UPLOAD_ROOT storage. Refuses anything that does not resolve to a plain file
// directly inside UPLOAD_ROOT/private-events (no traversal, no other modules).
const removeFile = (image) => {
  const resolved = resolveUploadFile(image);
  if (!resolved) return;
  const baseDir = path.resolve(getUploadDir('private-events'));
  const target = path.resolve(resolved);
  if (path.dirname(target) !== baseDir) return;
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (err) {
    console.warn('Private-events file delete failed:', err.message);
  }
};

/* ── Public: everything the /private-events page needs in one call ── */
const getPublicContent = async (req, res) => {
  try {
    await ensureTables();
    const heroRows = await executeQuery(
      "SELECT * FROM private_events_hero WHERE status='active' ORDER BY sort_order ASC, id DESC LIMIT 1"
    );
    const gallery = await executeQuery(
      "SELECT * FROM private_events_gallery WHERE status='active' ORDER BY sort_order ASC, id ASC"
    );
    res.json({ success: true, data: { hero: heroRows[0] || null, gallery } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* ── Hero admin CRUD ── */
const heroFields = (b) => ({
  eyebrow: b.eyebrow || null,
  heading: b.heading || b.title || '',
  description: b.description || null,
  supporting_text: b.supporting_text || null,
  primary_cta_text: b.primary_cta_text || 'Enquire About Your Event',
  secondary_cta_text: b.secondary_cta_text || 'Explore Outlet Locations',
  image_alt: b.image_alt || null,
  status: b.status === 'inactive' ? 'inactive' : 'active',
  sort_order: b.sort_order ? parseInt(b.sort_order, 10) : 0,
});

const getHeroAll = async (req, res) => {
  try {
    await ensureTables();
    const rows = await executeQuery('SELECT * FROM private_events_hero ORDER BY sort_order ASC, id DESC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Discard freshly uploaded files when a request is rejected
const discardUploads = (req) => {
  const files = [req.file, ...(req.files?.image || []), ...(req.files?.mobile_image || [])].filter(Boolean);
  files.forEach((file) => removeFile(`uploads/private-events/${file.filename}`));
};

const createHero = async (req, res) => {
  try {
    await ensureTables();
    const f = heroFields(req.body);
    if (!f.heading) { discardUploads(req); return res.status(400).json({ success: false, message: 'Heading is required' }); }
    const image = req.files?.image?.[0] ? `uploads/private-events/${req.files.image[0].filename}` : null;
    const mobile = req.files?.mobile_image?.[0] ? `uploads/private-events/${req.files.mobile_image[0].filename}` : null;
    const result = await executeQuery(`
      INSERT INTO private_events_hero
        (eyebrow, heading, description, supporting_text, primary_cta_text, secondary_cta_text, image, mobile_image, image_alt, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [f.eyebrow, f.heading, f.description, f.supporting_text, f.primary_cta_text, f.secondary_cta_text, image, mobile, f.image_alt, f.status, f.sort_order]);
    res.json({ success: true, message: 'Created', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateHero = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const f = heroFields(req.body);
    if (!f.heading) { discardUploads(req); return res.status(400).json({ success: false, message: 'Heading is required' }); }
    const existing = await executeQuery('SELECT * FROM private_events_hero WHERE id=?', [id]);
    if (!existing.length) { discardUploads(req); return res.status(404).json({ success: false, message: 'Not found' }); }

    let image = existing[0].image;
    let mobile = existing[0].mobile_image;
    if (req.files?.image?.[0]) {
      removeFile(image);
      image = `uploads/private-events/${req.files.image[0].filename}`;
    }
    if (req.files?.mobile_image?.[0]) {
      removeFile(mobile);
      mobile = `uploads/private-events/${req.files.mobile_image[0].filename}`;
    }

    await executeQuery(`
      UPDATE private_events_hero SET
        eyebrow=?, heading=?, description=?, supporting_text=?,
        primary_cta_text=?, secondary_cta_text=?,
        image=?, mobile_image=?, image_alt=?, status=?, sort_order=?
      WHERE id=?
    `, [f.eyebrow, f.heading, f.description, f.supporting_text, f.primary_cta_text, f.secondary_cta_text, image, mobile, f.image_alt, f.status, f.sort_order, id]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeHero = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM private_events_hero WHERE id=?', [id]);
    if (existing.length) { removeFile(existing[0].image); removeFile(existing[0].mobile_image); }
    await executeQuery('DELETE FROM private_events_hero WHERE id=?', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

/* ── Gallery admin CRUD ── */
const getGalleryAll = async (req, res) => {
  try {
    await ensureTables();
    const rows = await executeQuery('SELECT * FROM private_events_gallery ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const galleryFields = (b) => ({
  outlet_slug: b.outlet_slug || null,
  outlet_name: b.outlet_name || null,
  caption: b.caption || null,
  alt_text: b.alt_text || null,
  status: b.status === 'inactive' ? 'inactive' : 'active',
  sort_order: b.sort_order ? parseInt(b.sort_order, 10) : 0,
});

const createGalleryItem = async (req, res) => {
  try {
    await ensureTables();
    if (!req.file) return res.status(400).json({ success: false, message: 'Image is required' });
    const f = galleryFields(req.body);
    const image = `uploads/private-events/${req.file.filename}`;
    const result = await executeQuery(`
      INSERT INTO private_events_gallery (image, outlet_slug, outlet_name, caption, alt_text, sort_order, status)
      VALUES (?,?,?,?,?,?,?)
    `, [image, f.outlet_slug, f.outlet_name, f.caption, f.alt_text, f.sort_order, f.status]);
    res.json({ success: true, message: 'Created', id: result.insertId });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateGalleryItem = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM private_events_gallery WHERE id=?', [id]);
    if (!existing.length) { discardUploads(req); return res.status(404).json({ success: false, message: 'Not found' }); }
    const f = galleryFields(req.body);
    let image = existing[0].image;
    if (req.file) {
      removeFile(image);
      image = `uploads/private-events/${req.file.filename}`;
    }
    await executeQuery(`
      UPDATE private_events_gallery SET image=?, outlet_slug=?, outlet_name=?, caption=?, alt_text=?, sort_order=?, status=? WHERE id=?
    `, [image, f.outlet_slug, f.outlet_name, f.caption, f.alt_text, f.sort_order, f.status, id]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeGalleryItem = async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM private_events_gallery WHERE id=?', [id]);
    if (existing.length) removeFile(existing[0].image);
    await executeQuery('DELETE FROM private_events_gallery WHERE id=?', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getPublicContent,
  getHeroAll, createHero, updateHero, removeHero,
  getGalleryAll, createGalleryItem, updateGalleryItem, removeGalleryItem,
};
