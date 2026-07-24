const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS page_heroes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      page_key VARCHAR(100) NOT NULL UNIQUE,
      page_name VARCHAR(150) NOT NULL,
      label VARCHAR(150) NULL,
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      hero_image VARCHAR(500) NULL,
      mobile_hero_image VARCHAR(500) NULL,
      primary_button_text VARCHAR(100) NULL,
      primary_button_url VARCHAR(255) NULL,
      secondary_button_text VARCHAR(100) NULL,
      secondary_button_url VARCHAR(255) NULL,
      overlay_opacity DECIMAL(3,2) DEFAULT 0.45,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Remove legacy contact row that was seeded before generic/contact split
  await executeQuery("DELETE FROM page_heroes WHERE page_key = 'contact'");

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM page_heroes');
  if (rows[0].cnt === 0) {
    await executeQuery(
      `INSERT INTO page_heroes
        (page_key, page_name, label, title, subtitle,
         primary_button_text, primary_button_url,
         secondary_button_text, secondary_button_url,
         overlay_opacity, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'our-story', 'Our Story', 'BIG BEAN CAFE', 'Our Story',
        'From one café dream to a growing coffee community across Bengaluru.',
        'Explore Our Menu', '/menu',
        'Visit Our Outlets', '/outlets',
        0.45, 'active'
      ]
    );
  }
};

const getByPageKey = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      'SELECT * FROM page_heroes WHERE page_key = ? AND status = ? LIMIT 1',
      [req.params.pageKey, 'active']
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery("SELECT * FROM page_heroes WHERE page_key != 'contact' ORDER BY page_name ASC");
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getByPageKeyAdmin = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM page_heroes WHERE page_key = ? LIMIT 1', [req.params.pageKey]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateByPageKey = async (req, res) => {
  try {
    await ensureTable();
    const { pageKey } = req.params;
    const {
      label, title, subtitle,
      primary_button_text, primary_button_url,
      secondary_button_text, secondary_button_url,
      overlay_opacity, status
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const existing = await executeQuery('SELECT * FROM page_heroes WHERE page_key = ?', [pageKey]);

    let heroImage = req.files?.hero_image?.[0]
      ? `uploads/page-heroes/${req.files.hero_image[0].filename}`
      : null;
    let mobileHeroImage = req.files?.mobile_hero_image?.[0]
      ? `uploads/page-heroes/${req.files.mobile_hero_image[0].filename}`
      : null;

    if (existing.length) {
      const old = existing[0];
      if (req.files?.hero_image?.[0] && old.hero_image) {
        const p = path.join(__dirname, '../', old.hero_image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (req.files?.mobile_hero_image?.[0] && old.mobile_hero_image) {
        const p = path.join(__dirname, '../', old.mobile_hero_image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (!heroImage) heroImage = old.hero_image;
      if (!mobileHeroImage) mobileHeroImage = old.mobile_hero_image;

      await executeQuery(
        `UPDATE page_heroes SET
          label=?, title=?, subtitle=?,
          primary_button_text=?, primary_button_url=?,
          secondary_button_text=?, secondary_button_url=?,
          hero_image=?, mobile_hero_image=?,
          overlay_opacity=?, status=?
        WHERE page_key=?`,
        [
          label || null, title, subtitle || null,
          primary_button_text || null, primary_button_url || null,
          secondary_button_text || null, secondary_button_url || null,
          heroImage, mobileHeroImage,
          overlay_opacity !== undefined ? parseFloat(overlay_opacity) : 0.45,
          status || 'active',
          pageKey
        ]
      );
    } else {
      await executeQuery(
        `INSERT INTO page_heroes
          (page_key, page_name, label, title, subtitle,
           primary_button_text, primary_button_url,
           secondary_button_text, secondary_button_url,
           hero_image, mobile_hero_image,
           overlay_opacity, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          pageKey, pageKey, label || null, title, subtitle || null,
          primary_button_text || null, primary_button_url || null,
          secondary_button_text || null, secondary_button_url || null,
          heroImage, mobileHeroImage,
          overlay_opacity !== undefined ? parseFloat(overlay_opacity) : 0.45,
          status || 'active'
        ]
      );
    }

    const updated = await executeQuery('SELECT * FROM page_heroes WHERE page_key = ? LIMIT 1', [pageKey]);
    res.json({ success: true, message: 'Page hero updated successfully', data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getByPageKey,
  getAll,
  getByPageKeyAdmin,
  updateByPageKey
};
