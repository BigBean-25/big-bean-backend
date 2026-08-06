const path = require('path');
const fs   = require('fs');
const { executeQuery } = require('../config/database');
const { resolveUploadFile } = require('../config/uploadPaths');

// ── helpers ──────────────────────────────────────────────────────────────────

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const BLOCKED_URL = /^(javascript:|data:|vbscript:)/i;
const sanitizeUrl = (url) => {
  if (!url) return null;
  const t = String(url).trim();
  return BLOCKED_URL.test(t) ? null : t;
};

const boolVal = (v) => v === true || v === 'true' || v === 1 || v === '1';

const tryDeleteUpload = (imgPath) => {
  if (!imgPath) return;
  const full = resolveUploadFile(imgPath);
  if (full && fs.existsSync(full)) { try { fs.unlinkSync(full); } catch {} }
};

const BACKEND_URL = (process.env.BACKEND_URL || process.env.APP_URL || '').replace(/\/$/, '');

const buildImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith('http')) return img;
  if (!BACKEND_URL) return img;
  return `${BACKEND_URL}/${img.replace(/^\/+/, '')}`;
};

// ── table init ───────────────────────────────────────────────────────────────

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS website_popups (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      popup_type ENUM('merchandise','event','offer','general') NOT NULL DEFAULT 'general',
      short_description TEXT NULL,
      desktop_image VARCHAR(500) NOT NULL,
      mobile_image VARCHAR(500) NULL,
      link_enabled TINYINT(1) NOT NULL DEFAULT 0,
      button_text VARCHAR(100) NULL,
      button_url VARCHAR(1000) NULL,
      open_in_new_tab TINYINT(1) NOT NULL DEFAULT 0,
      image_clickable TINYINT(1) NOT NULL DEFAULT 0,
      display_delay_ms INT UNSIGNED NOT NULL DEFAULT 0,
      display_frequency ENUM('every_visit','once_per_session','once_per_day','show_once') NOT NULL DEFAULT 'once_per_session',
      target_pages JSON NULL,
      target_devices ENUM('all','desktop','mobile') NOT NULL DEFAULT 'all',
      priority INT NOT NULL DEFAULT 0,
      start_at DATETIME NULL,
      end_at DATETIME NULL,
      status TINYINT(1) NOT NULL DEFAULT 1,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_popup_status (status),
      INDEX idx_popup_schedule (start_at, end_at),
      INDEX idx_popup_priority (priority)
    )
  `);
};
ensureTable().catch(err => console.error('[website_popups] table init error:', err.message));

const ensureColumns = async () => {
  const cols = [
    `ALTER TABLE website_popups ADD COLUMN IF NOT EXISTS image_click_enabled TINYINT(1) NOT NULL DEFAULT 0`,
    `ALTER TABLE website_popups ADD COLUMN IF NOT EXISTS image_click_url VARCHAR(2048) NULL`,
    `ALTER TABLE website_popups ADD COLUMN IF NOT EXISTS image_click_new_tab TINYINT(1) NOT NULL DEFAULT 0`,
  ];
  for (const sql of cols) {
    await executeQuery(sql).catch(() => {});
  }
};
ensureColumns().catch(err => console.error('[website_popups] ensureColumns error:', err.message));

// ── unique slug ──────────────────────────────────────────────────────────────

const makeUniqueSlug = async (title, excludeId = null) => {
  const base = slugify(title) || 'popup';
  let slug = base;
  let counter = 1;
  for (;;) {
    const q = excludeId
      ? 'SELECT id FROM website_popups WHERE slug = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM website_popups WHERE slug = ? LIMIT 1';
    const p = excludeId ? [slug, excludeId] : [slug];
    const rows = await executeQuery(q, p);
    if (!rows.length) break;
    slug = `${base}-${counter++}`;
  }
  return slug;
};

// ── column sets ──────────────────────────────────────────────────────────────

const PUBLIC_COLS = `
  id, title, slug, popup_type, short_description,
  desktop_image, mobile_image,
  link_enabled, button_text, button_url, open_in_new_tab, image_clickable,
  image_click_enabled, image_click_url, image_click_new_tab,
  display_delay_ms, display_frequency, target_devices, priority`;

const ADMIN_COLS = `
  id, title, slug, popup_type, short_description,
  desktop_image, mobile_image,
  link_enabled, button_text, button_url, open_in_new_tab, image_clickable,
  image_click_enabled, image_click_url, image_click_new_tab,
  display_delay_ms, display_frequency,
  target_pages, target_devices, priority,
  start_at, end_at, status, created_by, created_at, updated_at`;

// ── PUBLIC: active popup ─────────────────────────────────────────────────────

const normalizeDevice = (v) => {
  if (!v) return 'all';
  const s = String(v).toLowerCase().trim();
  if (s === 'desktop') return 'desktop';
  if (s === 'mobile')  return 'mobile';
  return 'all';
};

const normalizePagesJson = (target_pages) => {
  if (!target_pages) return null;
  try {
    const parsed = typeof target_pages === 'string' ? JSON.parse(target_pages) : target_pages;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const filtered = parsed.filter(p => p !== 'all');
    return filtered.length === 0 ? null : JSON.stringify(filtered);
  } catch {
    return null;
  }
};

const getActivePopup = async (req, res) => {
  try {
    const { page, device } = req.query;
    const reqDevice = normalizeDevice(device);

    // Use MySQL NOW() — avoids UTC vs local-time mismatch on the server
    const rows = await executeQuery(
      `SELECT ${PUBLIC_COLS}, target_pages
       FROM website_popups
       WHERE status = 1
         AND (start_at IS NULL OR start_at <= NOW())
         AND (end_at   IS NULL OR end_at   >= NOW())
       ORDER BY priority DESC, created_at DESC`
    );

    let match = null;
    for (const row of rows) {
      // Device targeting — 'all' matches any device
      if (device) {
        const td = normalizeDevice(row.target_devices);
        if (td !== 'all') {
          if (td !== reqDevice) continue;
        }
      }

      // Page targeting — NULL or empty array means all pages
      if (page) {
        const rawPages = row.target_pages;
        if (rawPages !== null && rawPages !== undefined) {
          let pages;
          try { pages = typeof rawPages === 'string' ? JSON.parse(rawPages) : rawPages; }
          catch { pages = null; }
          if (Array.isArray(pages) && pages.length > 0) {
            const specific = pages.filter(p => p !== 'all');
            if (specific.length > 0 && !specific.includes(page)) continue;
          }
        }
      }

      match = row;
      break;
    }

    if (!match) return res.json({ success: true, data: null });

    const { target_pages: _tp, ...safe } = match;

    res.json({ success: true, data: safe });
  } catch (err) {
    console.error('[popup] getActivePopup error:', err.message);
    res.json({ success: true, data: null });
  }
};

// ── ADMIN: list ──────────────────────────────────────────────────────────────

const getAllPopups = async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];

    if (type)   { conditions.push('popup_type = ?'); params.push(type); }
    if (status !== undefined && status !== '') { conditions.push('status = ?'); params.push(status); }
    if (search) { conditions.push('title LIKE ?'); params.push(`%${search}%`); }

    const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (Math.max(parseInt(page), 1) - 1) * parseInt(limit);

    const rows  = await executeQuery(
      `SELECT ${ADMIN_COLS} FROM website_popups ${where} ORDER BY priority DESC, updated_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const total = await executeQuery(`SELECT COUNT(*) AS cnt FROM website_popups ${where}`, params);

    res.json({ success: true, data: rows, total: total[0].cnt, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('[popup] getAllPopups error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── ADMIN: get by id ─────────────────────────────────────────────────────────

const getPopupById = async (req, res) => {
  try {
    const rows = await executeQuery(`SELECT ${ADMIN_COLS} FROM website_popups WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Popup not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[popup] getPopupById error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── ADMIN: create ────────────────────────────────────────────────────────────

const createPopup = async (req, res) => {
  try {
    const {
      title, popup_type, short_description,
      link_enabled, button_text, button_url, open_in_new_tab, image_clickable,
      display_delay_ms, display_frequency,
      target_pages, target_devices, priority,
      start_at, end_at, status
    } = req.body;

    if (!title || !String(title).trim())
      return res.status(400).json({ success: false, message: 'Title is required' });
    if (String(title).trim().length > 255)
      return res.status(400).json({ success: false, message: 'Title must be 255 characters or less' });

    const files = req.files || {};
    if (!files.desktop_image)
      return res.status(400).json({ success: false, message: 'Desktop image is required' });

    const desktop_image = `uploads/website-popups/${files.desktop_image[0].filename}`;
    const mobile_image  = files.mobile_image
      ? `uploads/website-popups/${files.mobile_image[0].filename}`
      : null;

    const {
      image_click_enabled, image_click_url, image_click_new_tab
    } = req.body;
    const imgClickOn = boolVal(image_click_enabled);

    if (start_at && end_at && new Date(end_at) <= new Date(start_at))
      return res.status(400).json({ success: false, message: 'End date must be after start date' });

    const slug    = await makeUniqueSlug(title);
    const linkOn  = boolVal(link_enabled);

    const pagesJson = normalizePagesJson(target_pages);
    const savedStatus = (status === undefined || status === null) ? 1 : (boolVal(status) ? 1 : 0);

    const result = await executeQuery(
      `INSERT INTO website_popups
        (title, slug, popup_type, short_description,
         desktop_image, mobile_image,
         link_enabled, button_text, button_url, open_in_new_tab, image_clickable,
         image_click_enabled, image_click_url, image_click_new_tab,
         display_delay_ms, display_frequency,
         target_pages, target_devices, priority,
         start_at, end_at, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      // values appended below
      [
        String(title).trim(),
        slug,
        ['merchandise','event','offer','general'].includes(popup_type) ? popup_type : 'general',
        short_description ? String(short_description).slice(0, 500) : null,
        desktop_image,
        mobile_image,
        linkOn ? 1 : 0,
        linkOn && button_text ? String(button_text).slice(0, 100) : null,
        linkOn ? sanitizeUrl(button_url) : null,
        linkOn && boolVal(open_in_new_tab) ? 1 : 0,
        linkOn && boolVal(image_clickable) ? 1 : 0,
        imgClickOn ? 1 : 0,
        imgClickOn && image_click_url ? sanitizeUrl(image_click_url) : null,
        imgClickOn && boolVal(image_click_new_tab) ? 1 : 0,
        Math.min(Math.max(parseInt(display_delay_ms) || 0, 0), 30000),
        ['every_visit','once_per_session','once_per_day','show_once'].includes(display_frequency) ? display_frequency : 'once_per_session',
        pagesJson,
        normalizeDevice(target_devices),
        parseInt(priority) || 0,
        start_at && String(start_at).trim() ? String(start_at).trim() : null,
        end_at   && String(end_at).trim()   ? String(end_at).trim()   : null,
        savedStatus,
        req.admin?.id || req.user?.id || null
      ]
    );

    res.status(201).json({ success: true, message: 'Popup created successfully', data: { id: result.insertId } });
  } catch (err) {
    console.error('[popup] createPopup error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── ADMIN: update ────────────────────────────────────────────────────────────

const updatePopup = async (req, res) => {
  try {
    const { id } = req.params;
    const existingRows = await executeQuery('SELECT id, desktop_image, mobile_image FROM website_popups WHERE id = ?', [id]);
    if (!existingRows.length) return res.status(404).json({ success: false, message: 'Popup not found' });
    const existingRecord = existingRows[0];

    const {
      title, popup_type, short_description,
      link_enabled, button_text, button_url, open_in_new_tab, image_clickable,
      display_delay_ms, display_frequency,
      target_pages, target_devices, priority,
      start_at, end_at, status,
      remove_mobile_image, remove_desktop_image,
      image_click_enabled, image_click_url, image_click_new_tab
    } = req.body;
    const imgClickOn = boolVal(image_click_enabled);

    const fields = [];
    const values = [];
    const linkOn = boolVal(link_enabled);

    if (title !== undefined) {
      const t = String(title).trim();
      if (!t) return res.status(400).json({ success: false, message: 'Title cannot be empty' });
      if (t.length > 255) return res.status(400).json({ success: false, message: 'Title must be 255 characters or less' });
      fields.push('title = ?', 'slug = ?');
      values.push(t, await makeUniqueSlug(t, id));
    }
    if (popup_type    !== undefined) { fields.push('popup_type = ?');    values.push(['merchandise','event','offer','general'].includes(popup_type) ? popup_type : 'general'); }
    if (short_description !== undefined) { fields.push('short_description = ?'); values.push(short_description ? String(short_description).slice(0, 500) : null); }
    if (link_enabled  !== undefined) { fields.push('link_enabled = ?');  values.push(linkOn ? 1 : 0); }
    if (button_text   !== undefined) { fields.push('button_text = ?');   values.push(linkOn && button_text ? String(button_text).slice(0, 100) : null); }
    if (button_url    !== undefined) { fields.push('button_url = ?');    values.push(linkOn ? sanitizeUrl(button_url) : null); }
    if (open_in_new_tab !== undefined) { fields.push('open_in_new_tab = ?'); values.push(linkOn && boolVal(open_in_new_tab) ? 1 : 0); }
    if (image_clickable !== undefined) { fields.push('image_clickable = ?'); values.push(linkOn && boolVal(image_clickable) ? 1 : 0); }
    if (display_delay_ms !== undefined) { fields.push('display_delay_ms = ?'); values.push(Math.min(Math.max(parseInt(display_delay_ms) || 0, 0), 30000)); }
    if (display_frequency !== undefined) { fields.push('display_frequency = ?'); values.push(['every_visit','once_per_session','once_per_day','show_once'].includes(display_frequency) ? display_frequency : 'once_per_session'); }
    if (target_devices !== undefined) { fields.push('target_devices = ?'); values.push(normalizeDevice(target_devices)); }
    if (priority !== undefined) { fields.push('priority = ?'); values.push(parseInt(priority) || 0); }
    if (start_at !== undefined) { fields.push('start_at = ?'); values.push(start_at && String(start_at).trim() ? String(start_at).trim() : null); }
    if (end_at   !== undefined) { fields.push('end_at = ?');   values.push(end_at   && String(end_at).trim()   ? String(end_at).trim()   : null); }
    if (status   !== undefined) { fields.push('status = ?');   values.push(boolVal(status) ? 1 : 0); }

    if (target_pages !== undefined) {
      fields.push('target_pages = ?');
      values.push(normalizePagesJson(target_pages));
    }

    if (image_click_enabled !== undefined) { fields.push('image_click_enabled = ?'); values.push(imgClickOn ? 1 : 0); }
    if (image_click_url     !== undefined) { fields.push('image_click_url = ?');     values.push(imgClickOn && image_click_url ? sanitizeUrl(image_click_url) : null); }
    if (image_click_new_tab !== undefined) { fields.push('image_click_new_tab = ?'); values.push(imgClickOn && boolVal(image_click_new_tab) ? 1 : 0); }

    const files = req.files || {};
    if (files.desktop_image) {
      fields.push('desktop_image = ?');
      values.push(`uploads/website-popups/${files.desktop_image[0].filename}`);
      tryDeleteUpload(existingRecord.desktop_image);
    }
    if (files.mobile_image) {
      fields.push('mobile_image = ?');
      values.push(`uploads/website-popups/${files.mobile_image[0].filename}`);
      tryDeleteUpload(existingRecord.mobile_image);
    }
    if (boolVal(remove_desktop_image) && !files.desktop_image) { fields.push('desktop_image = ?'); values.push(null); tryDeleteUpload(existingRecord.desktop_image); }
    if (boolVal(remove_mobile_image)  && !files.mobile_image)  { fields.push('mobile_image = ?');  values.push(null); tryDeleteUpload(existingRecord.mobile_image); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });

    values.push(id);
    await executeQuery(`UPDATE website_popups SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Popup updated successfully' });
  } catch (err) {
    console.error('[popup] updatePopup error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── ADMIN: toggle status ─────────────────────────────────────────────────────

const togglePopupStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await executeQuery('SELECT id, status FROM website_popups WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Popup not found' });

    const newStatus = req.body.status !== undefined
      ? (boolVal(req.body.status) ? 1 : 0)
      : (rows[0].status === 1 ? 0 : 1);

    await executeQuery('UPDATE website_popups SET status = ? WHERE id = ?', [newStatus, id]);
    res.json({ success: true, message: newStatus ? 'Popup enabled' : 'Popup disabled', data: { status: newStatus } });
  } catch (err) {
    console.error('[popup] togglePopupStatus error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── ADMIN: delete ────────────────────────────────────────────────────────────

const deletePopup = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT id, desktop_image, mobile_image FROM website_popups WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Popup not found' });

    await executeQuery('DELETE FROM website_popups WHERE id = ?', [req.params.id]);
    tryDeleteUpload(rows[0].desktop_image);
    tryDeleteUpload(rows[0].mobile_image);

    res.json({ success: true, message: 'Popup deleted successfully' });
  } catch (err) {
    console.error('[popup] deletePopup error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getActivePopup,
  getAllPopups, getPopupById,
  createPopup, updatePopup,
  togglePopupStatus, deletePopup
};
