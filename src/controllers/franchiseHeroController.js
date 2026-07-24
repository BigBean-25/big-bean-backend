const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS franchise_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'FRANCHISE WITH BIG BEAN CAFÉ',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Submit Enquiry',
      button_primary_url VARCHAR(500) DEFAULT '#franchise-form',
      button_secondary_text VARCHAR(100) DEFAULT 'Why Partner With Us',
      button_secondary_url VARCHAR(500) DEFAULT '#why-franchise',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT '7+',
      stat_1_label VARCHAR(100) DEFAULT 'Outlets',
      stat_2_value VARCHAR(50) DEFAULT 'FOCO',
      stat_2_label VARCHAR(100) DEFAULT 'Growth Model',
      stat_3_value VARCHAR(50) DEFAULT '360°',
      stat_3_label VARCHAR(100) DEFAULT 'Brand Support',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const existing = await executeQuery('SELECT id FROM franchise_hero_banners LIMIT 1');
  if (existing.length === 0) {
    await executeQuery(`
      INSERT INTO franchise_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'FRANCHISE WITH BIG BEAN CAFÉ',
      'Build a Coffee Business',
      'With a Growing Brand',
      'Partner with Big Bean Café and bring premium coffee, food, events and café culture to high-potential locations.',
      'Submit Enquiry', '#franchise-form',
      'Why Partner With Us', '#why-franchise',
      '7+', 'Outlets',
      'FOCO', 'Growth Model',
      '360°', 'Brand Support',
      'active', 1
    ]);
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM franchise_hero_banners ORDER BY sort_order ASC, id DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get franchise hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM franchise_hero_banners WHERE status='active' ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (error) {
    console.error('Get active franchise hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM franchise_hero_banners WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get franchise hero by id error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
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

    const imagePath = req.file ? `uploads/franchise-hero/${req.file.filename}` : null;

    const result = await executeQuery(`
      INSERT INTO franchise_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image, stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'FRANCHISE WITH BIG BEAN CAFÉ', title, highlight_text || null, subtitle || null,
      button_primary_text || 'Submit Enquiry', button_primary_url || '#franchise-form',
      button_secondary_text || 'Why Partner With Us', button_secondary_url || '#why-franchise',
      imagePath,
      stat_1_value || '7+', stat_1_label || 'Outlets',
      stat_2_value || 'FOCO', stat_2_label || 'Growth Model',
      stat_3_value || '360°', stat_3_label || 'Brand Support',
      status || 'active', sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Banner created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create franchise hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM franchise_hero_banners WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });

    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label, stat_2_value, stat_2_label,
      stat_3_value, stat_3_label, status, sort_order
    } = req.body;

    let imagePath = existing[0].image;
    if (req.file) {
      if (existing[0].image) {
        const oldPath = path.join(__dirname, '../', existing[0].image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      imagePath = `uploads/franchise-hero/${req.file.filename}`;
    }

    await executeQuery(`
      UPDATE franchise_hero_banners SET
        eyebrow=?, title=?, highlight_text=?, subtitle=?,
        button_primary_text=?, button_primary_url=?,
        button_secondary_text=?, button_secondary_url=?,
        image=?, stat_1_value=?, stat_1_label=?,
        stat_2_value=?, stat_2_label=?, stat_3_value=?, stat_3_label=?,
        status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [
      eyebrow || 'FRANCHISE WITH BIG BEAN CAFÉ', title, highlight_text || null, subtitle || null,
      button_primary_text || 'Submit Enquiry', button_primary_url || '#franchise-form',
      button_secondary_text || 'Why Partner With Us', button_secondary_url || '#why-franchise',
      imagePath,
      stat_1_value || '7+', stat_1_label || 'Outlets',
      stat_2_value || 'FOCO', stat_2_label || 'Growth Model',
      stat_3_value || '360°', stat_3_label || 'Brand Support',
      status || 'active', sort_order || 0, id
    ]);

    res.json({ success: true, message: 'Banner updated successfully' });
  } catch (error) {
    console.error('Update franchise hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM franchise_hero_banners WHERE id=?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });

    if (existing[0].image) {
      const imgPath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await executeQuery('DELETE FROM franchise_hero_banners WHERE id=?', [id]);
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete franchise hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getAll, getActive, getById, create, update, deleteBanner };
