const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS about_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'ABOUT US',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Know Our Story',
      button_primary_url VARCHAR(500) DEFAULT '#story',
      button_secondary_text VARCHAR(100) DEFAULT 'Explore Outlets',
      button_secondary_url VARCHAR(500) DEFAULT '/outlets',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT '7+',
      stat_1_label VARCHAR(100) DEFAULT 'Outlets',
      stat_2_value VARCHAR(50) DEFAULT '50K+',
      stat_2_label VARCHAR(100) DEFAULT 'Happy Customers',
      stat_3_value VARCHAR(50) DEFAULT '100%',
      stat_3_label VARCHAR(100) DEFAULT 'Quality Coffee',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM about_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO about_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label,
         stat_2_value, stat_2_label,
         stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'ABOUT US',
      'Brewed with Passion,',
      'Served with Heart.',
      'Big Bean Café is more than just coffee — it\'s an experience crafted with passion, quality, and a love for bringing people together.',
      'Know Our Story', '#story',
      'Explore Outlets', '/outlets',
      '7+', 'Outlets',
      '50K+', 'Happy Customers',
      '100%', 'Quality Coffee',
      'active', 1
    ]);
  }
};

ensureTable().catch(err => console.error('about_hero_banners table init error:', err));

const getAll = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM about_hero_banners ORDER BY sort_order ASC, created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAll about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getActive = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM about_hero_banners WHERE status = ? ORDER BY sort_order ASC, created_at DESC LIMIT 1',
      ['active']
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    console.error('getActive about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM about_hero_banners WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getById about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label,
      stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const image = req.file ? `uploads/about-hero/${req.file.filename}` : null;

    const result = await executeQuery(`
      INSERT INTO about_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image, stat_1_value, stat_1_label,
         stat_2_value, stat_2_label,
         stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eyebrow || 'ABOUT US',
      title.trim(),
      highlight_text || null,
      subtitle || null,
      button_primary_text || 'Know Our Story',
      button_primary_url || '#story',
      button_secondary_text || 'Explore Outlets',
      button_secondary_url || '/outlets',
      image,
      stat_1_value || '7+',
      stat_1_label || 'Outlets',
      stat_2_value || '50K+',
      stat_2_label || 'Happy Customers',
      stat_3_value || '100%',
      stat_3_label || 'Quality Coffee',
      status || 'active',
      parseInt(sort_order) || 0
    ]);

    res.status(201).json({ success: true, message: 'Created successfully', data: { id: result.insertId } });
  } catch (err) {
    console.error('create about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM about_hero_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label,
      stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    let image = existing[0].image;
    if (req.file) {
      if (image && !image.startsWith('http')) {
        const oldPath = path.join(__dirname, '../', image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = `uploads/about-hero/${req.file.filename}`;
    }

    await executeQuery(`
      UPDATE about_hero_banners SET
        eyebrow = ?, title = ?, highlight_text = ?, subtitle = ?,
        button_primary_text = ?, button_primary_url = ?,
        button_secondary_text = ?, button_secondary_url = ?,
        image = ?, stat_1_value = ?, stat_1_label = ?,
        stat_2_value = ?, stat_2_label = ?,
        stat_3_value = ?, stat_3_label = ?,
        status = ?, sort_order = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      eyebrow || 'ABOUT US',
      title.trim(),
      highlight_text || null,
      subtitle || null,
      button_primary_text || 'Know Our Story',
      button_primary_url || '#story',
      button_secondary_text || 'Explore Outlets',
      button_secondary_url || '/outlets',
      image,
      stat_1_value || '7+',
      stat_1_label || 'Outlets',
      stat_2_value || '50K+',
      stat_2_label || 'Happy Customers',
      stat_3_value || '100%',
      stat_3_label || 'Quality Coffee',
      status || 'active',
      parseInt(sort_order) || 0,
      id
    ]);

    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('update about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM about_hero_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    const image = existing[0].image;
    if (image && !image.startsWith('http')) {
      const filePath = path.join(__dirname, '../', image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await executeQuery('DELETE FROM about_hero_banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('delete about-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
