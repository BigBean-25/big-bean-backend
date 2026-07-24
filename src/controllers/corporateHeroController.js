const { executeQuery } = require('../config/database');
const path = require('path');
const fs = require('fs');

let tableReady = false;

const ensureTable = async () => {
  if (tableReady) return;
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS corporate_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'CORPORATE ORDERS',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Request Corporate Quote',
      button_primary_url VARCHAR(500) DEFAULT '#corporate-form',
      button_secondary_text VARCHAR(100) DEFAULT 'Explore Solutions',
      button_secondary_url VARCHAR(500) DEFAULT '#corporate-solutions',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT 'Bulk',
      stat_1_label VARCHAR(100) DEFAULT 'Orders',
      stat_2_value VARCHAR(50) DEFAULT 'Events',
      stat_2_label VARCHAR(100) DEFAULT 'Catering',
      stat_3_value VARCHAR(50) DEFAULT 'Custom',
      stat_3_label VARCHAR(100) DEFAULT 'Solutions',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM corporate_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO corporate_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label,
         stat_2_value, stat_2_label,
         stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'CORPORATE ORDERS',
      'Premium Coffee Solutions',
      'for Modern Workplaces',
      'From office coffee requirements to event catering, meetings, bulk orders and custom café solutions — Big Bean Café brings quality, freshness and service to your business.',
      'Request Corporate Quote', '#corporate-form',
      'Explore Solutions', '#corporate-solutions',
      'Bulk', 'Orders',
      'Events', 'Catering',
      'Custom', 'Solutions',
      'active', 1
    ]);
  }
  tableReady = true;
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_hero_banners ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch banners' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM corporate_hero_banners WHERE status='active' ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch active banner' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_hero_banners WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to fetch banner' });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label,
      stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const imagePath = req.file ? `uploads/corporate-hero/${req.file.filename}` : null;

    const result = await executeQuery(`
      INSERT INTO corporate_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image,
         stat_1_value, stat_1_label,
         stat_2_value, stat_2_label,
         stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'CORPORATE ORDERS', title, highlight_text || null, subtitle || null,
      button_primary_text || 'Request Corporate Quote', button_primary_url || '#corporate-form',
      button_secondary_text || 'Explore Solutions', button_secondary_url || '#corporate-solutions',
      imagePath,
      stat_1_value || 'Bulk', stat_1_label || 'Orders',
      stat_2_value || 'Events', stat_2_label || 'Catering',
      stat_3_value || 'Custom', stat_3_label || 'Solutions',
      status || 'active', sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Banner created', data: { id: result.insertId } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to create banner' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_hero_banners WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Banner not found' });
    const existing = rows[0];

    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label,
      stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;

    let imagePath = existing.image;
    if (req.file) {
      if (existing.image) {
        const old = path.join(__dirname, '../../', existing.image.replace(/^\//, ''));
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      imagePath = `uploads/corporate-hero/${req.file.filename}`;
    }

    await executeQuery(`
      UPDATE corporate_hero_banners SET
        eyebrow=?, title=?, highlight_text=?, subtitle=?,
        button_primary_text=?, button_primary_url=?,
        button_secondary_text=?, button_secondary_url=?,
        image=?,
        stat_1_value=?, stat_1_label=?,
        stat_2_value=?, stat_2_label=?,
        stat_3_value=?, stat_3_label=?,
        status=?, sort_order=?
      WHERE id=?
    `, [
      eyebrow || existing.eyebrow, title || existing.title,
      highlight_text !== undefined ? highlight_text : existing.highlight_text,
      subtitle !== undefined ? subtitle : existing.subtitle,
      button_primary_text || existing.button_primary_text,
      button_primary_url || existing.button_primary_url,
      button_secondary_text || existing.button_secondary_text,
      button_secondary_url || existing.button_secondary_url,
      imagePath,
      stat_1_value || existing.stat_1_value, stat_1_label || existing.stat_1_label,
      stat_2_value || existing.stat_2_value, stat_2_label || existing.stat_2_label,
      stat_3_value || existing.stat_3_value, stat_3_label || existing.stat_3_label,
      status || existing.status, sort_order !== undefined ? sort_order : existing.sort_order,
      req.params.id
    ]);

    res.json({ success: true, message: 'Banner updated' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update banner' });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM corporate_hero_banners WHERE id=?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Banner not found' });
    if (rows[0].image) {
      const p = path.join(__dirname, '../../', rows[0].image.replace(/^\//, ''));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await executeQuery('DELETE FROM corporate_hero_banners WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to delete banner' });
  }
};

module.exports = { getAll, getActive, getById, create, update, deleteBanner };
