const { executeQuery } = require('../config/database');
const fs = require('fs');
const { resolveUploadFile } = require('../config/uploadPaths');

// ── Social URL validator ─────────────────────────────────────────────────────
// Returns true when url is blank (optional field) or is a valid http/https
// URL pointing to the expected platform hostname.
const isValidSocialUrl = (url, platform) => {
  if (!url || !url.trim()) return true;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (platform === 'instagram') return host === 'instagram.com' || host === 'www.instagram.com';
    if (platform === 'linkedin')  return host === 'linkedin.com'  || host === 'www.linkedin.com';
    return false;
  } catch {
    return false;
  }
};

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS about_founders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image VARCHAR(500) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      instagram_url VARCHAR(500) NULL,
      linkedin_url VARCHAR(500) NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

ensureTable().catch(err => console.error('about_founders table init error:', err));

const getAll = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM about_founders ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAll about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getActive = async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT id, name, role, description, image, phone, email,
              instagram_url, linkedin_url, sort_order
       FROM about_founders
       WHERE status = 'active'
       ORDER BY sort_order ASC, id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getActive about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM about_founders WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getById about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { name, role, description, phone, email, instagram_url, linkedin_url, status, sort_order } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!role || !role.trim()) return res.status(400).json({ success: false, message: 'Role is required' });
    if (!description || !description.trim()) return res.status(400).json({ success: false, message: 'Description is required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Founder image is required' });

    if (email && email.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email.trim())) return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    if (!isValidSocialUrl(instagram_url, 'instagram'))
      return res.status(400).json({ success: false, message: 'Invalid Instagram URL' });
    if (!isValidSocialUrl(linkedin_url, 'linkedin'))
      return res.status(400).json({ success: false, message: 'Invalid LinkedIn URL' });

    const image = `uploads/about-founders/${req.file.filename}`;

    const result = await executeQuery(
      `INSERT INTO about_founders (name, role, description, image, phone, email, instagram_url, linkedin_url, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        role.trim(),
        description.trim(),
        image,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        instagram_url && instagram_url.trim() ? instagram_url.trim() : null,
        linkedin_url  && linkedin_url.trim()  ? linkedin_url.trim()  : null,
        status || 'active',
        parseInt(sort_order) || 0
      ]
    );

    res.status(201).json({ success: true, message: 'Founder created successfully', data: { id: result.insertId } });
  } catch (err) {
    console.error('create about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM about_founders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    const { name, role, description, phone, email, instagram_url, linkedin_url, status, sort_order } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!role || !role.trim()) return res.status(400).json({ success: false, message: 'Role is required' });
    if (!description || !description.trim()) return res.status(400).json({ success: false, message: 'Description is required' });

    if (email && email.trim()) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(email.trim())) return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    if (!isValidSocialUrl(instagram_url, 'instagram'))
      return res.status(400).json({ success: false, message: 'Invalid Instagram URL' });
    if (!isValidSocialUrl(linkedin_url, 'linkedin'))
      return res.status(400).json({ success: false, message: 'Invalid LinkedIn URL' });

    let image = existing[0].image;
    if (req.file) {
      if (image && !image.startsWith('http')) {
        const oldPath = resolveUploadFile(image);
        if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = `uploads/about-founders/${req.file.filename}`;
    }

    await executeQuery(
      `UPDATE about_founders SET
         name = ?, role = ?, description = ?, image = ?,
         phone = ?, email = ?, instagram_url = ?, linkedin_url = ?,
         status = ?, sort_order = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name.trim(),
        role.trim(),
        description.trim(),
        image,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        instagram_url && instagram_url.trim() ? instagram_url.trim() : null,
        linkedin_url  && linkedin_url.trim()  ? linkedin_url.trim()  : null,
        status || 'active',
        parseInt(sort_order) || 0,
        id
      ]
    );

    res.json({ success: true, message: 'Founder updated successfully' });
  } catch (err) {
    console.error('update about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM about_founders WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    const image = existing[0].image;
    if (image && !image.startsWith('http')) {
      const filePath = resolveUploadFile(image);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await executeQuery('DELETE FROM about_founders WHERE id = ?', [id]);
    res.json({ success: true, message: 'Founder deleted successfully' });
  } catch (err) {
    console.error('delete about-founders error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
