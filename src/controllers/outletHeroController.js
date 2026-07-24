const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS outlet_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'BIG BEAN CAFÉ OUTLETS',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Find Nearby Outlet',
      button_primary_url VARCHAR(500) DEFAULT '#outlet-list',
      button_secondary_text VARCHAR(100) DEFAULT 'Order Online',
      button_secondary_url VARCHAR(500) DEFAULT 'https://bigbeancafe.store',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT '7+',
      stat_1_label VARCHAR(100) DEFAULT 'Outlets',
      stat_2_value VARCHAR(50) DEFAULT 'Bengaluru',
      stat_2_label VARCHAR(100) DEFAULT 'Locations',
      stat_3_value VARCHAR(50) DEFAULT 'Daily',
      stat_3_label VARCHAR(100) DEFAULT 'Fresh Brews',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM outlet_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO outlet_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'BIG BEAN CAFÉ OUTLETS',
      'Find Your Favourite',
      'Big Bean Café',
      'Discover warm café spaces across Bengaluru for coffee, food, work, conversations, and memorable moments.',
      'Find Nearby Outlet', '#outlet-list',
      'Order Online', 'https://bigbeancafe.store',
      '7+', 'Outlets', 'Bengaluru', 'Locations',
      'Daily', 'Fresh Brews', 'active', 1
    ]);
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM outlet_hero_banners ORDER BY sort_order ASC, id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM outlet_hero_banners WHERE status='active' ORDER BY sort_order ASC, id DESC LIMIT 1"
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM outlet_hero_banners WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label, stat_2_value, stat_2_label,
      stat_3_value, stat_3_label, status, sort_order
    } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    const image = req.file ? `uploads/outlet-hero/${req.file.filename}` : null;
    const result = await executeQuery(`
      INSERT INTO outlet_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image, stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'BIG BEAN CAFÉ OUTLETS', title, highlight_text || null, subtitle || null,
      button_primary_text || 'Find Nearby Outlet', button_primary_url || '#outlet-list',
      button_secondary_text || 'Order Online', button_secondary_url || 'https://bigbeancafe.store',
      image, stat_1_value || '7+', stat_1_label || 'Outlets',
      stat_2_value || 'Bengaluru', stat_2_label || 'Locations',
      stat_3_value || 'Daily', stat_3_label || 'Fresh Brews',
      status || 'active', sort_order ? parseInt(sort_order) : 0
    ]);
    res.json({ success: true, message: 'Created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const existing = await executeQuery('SELECT * FROM outlet_hero_banners WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label, stat_2_value, stat_2_label,
      stat_3_value, stat_3_label, status, sort_order
    } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    let image = existing[0].image;
    if (req.file) {
      if (image) {
        const old = path.join(__dirname, '../', image);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      image = `uploads/outlet-hero/${req.file.filename}`;
    }
    await executeQuery(`
      UPDATE outlet_hero_banners SET
        eyebrow=?, title=?, highlight_text=?, subtitle=?,
        button_primary_text=?, button_primary_url=?,
        button_secondary_text=?, button_secondary_url=?,
        image=?, stat_1_value=?, stat_1_label=?, stat_2_value=?, stat_2_label=?,
        stat_3_value=?, stat_3_label=?, status=?, sort_order=?
      WHERE id=?
    `, [
      eyebrow || 'BIG BEAN CAFÉ OUTLETS', title, highlight_text || null, subtitle || null,
      button_primary_text || 'Find Nearby Outlet', button_primary_url || '#outlet-list',
      button_secondary_text || 'Order Online', button_secondary_url || 'https://bigbeancafe.store',
      image, stat_1_value || '7+', stat_1_label || 'Outlets',
      stat_2_value || 'Bengaluru', stat_2_label || 'Locations',
      stat_3_value || 'Daily', stat_3_label || 'Fresh Brews',
      status || 'active', sort_order ? parseInt(sort_order) : 0,
      req.params.id
    ]);
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await ensureTable();
    const existing = await executeQuery('SELECT * FROM outlet_hero_banners WHERE id=?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    if (existing[0].image) {
      const imgPath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await executeQuery('DELETE FROM outlet_hero_banners WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
