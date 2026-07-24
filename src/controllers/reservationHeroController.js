const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS reservation_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'TABLE RESERVATIONS',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Reserve Table',
      button_primary_url VARCHAR(500) DEFAULT '#reservation-form',
      button_secondary_text VARCHAR(100) DEFAULT 'View Outlets',
      button_secondary_url VARCHAR(500) DEFAULT '/outlets',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT '7+',
      stat_1_label VARCHAR(100) DEFAULT 'Outlets',
      stat_2_value VARCHAR(50) DEFAULT '30 Days',
      stat_2_label VARCHAR(100) DEFAULT 'Advance Booking',
      stat_3_value VARCHAR(50) DEFAULT 'Fast',
      stat_3_label VARCHAR(100) DEFAULT 'Confirmation',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM reservation_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO reservation_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'TABLE RESERVATIONS',
      'Reserve Your',
      'Perfect Café Moment',
      'Book your table at your nearby Big Bean Café outlet and enjoy fresh coffee, food and warm conversations.',
      'Reserve Table', '#reservation-form',
      'View Outlets', '/outlets',
      '7+', 'Outlets', '30 Days', 'Advance Booking',
      'Fast', 'Confirmation', 'active', 1
    ]);
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const banners = await executeQuery('SELECT * FROM reservation_hero_banners ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('Get reservation hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const banners = await executeQuery(
      "SELECT * FROM reservation_hero_banners WHERE status = 'active' ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    res.json({ success: true, data: banners[0] || null });
  } catch (error) {
    console.error('Get active reservation hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const banner = await executeQuery('SELECT * FROM reservation_hero_banners WHERE id = ?', [id]);
    if (banner.length === 0) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    res.json({ success: true, data: banner[0] });
  } catch (error) {
    console.error('Get reservation hero by ID error:', error);
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
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label, stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;
    
    // Handle image upload from multer
    const imagePath = req.file ? `uploads/reservation-hero/${req.file.filename}` : null;
    
    const result = await executeQuery(`
      INSERT INTO reservation_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image, stat_1_value, stat_1_label,
         stat_2_value, stat_2_label, stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'TABLE RESERVATIONS',
      title,
      highlight_text,
      subtitle,
      button_primary_text || 'Reserve Table',
      button_primary_url || '#reservation-form',
      button_secondary_text || 'View Outlets',
      button_secondary_url || '/outlets',
      imagePath,
      stat_1_value || '7+',
      stat_1_label || 'Outlets',
      stat_2_value || '30 Days',
      stat_2_label || 'Advance Booking',
      stat_3_value || 'Fast',
      stat_3_label || 'Confirmation',
      status || 'active',
      sort_order || 0
    ]);
    
    res.status(201).json({ success: true, message: 'Banner created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create reservation hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const {
      eyebrow, title, highlight_text, subtitle,
      button_primary_text, button_primary_url,
      button_secondary_text, button_secondary_url,
      stat_1_value, stat_1_label,
      stat_2_value, stat_2_label, stat_3_value, stat_3_label,
      status, sort_order
    } = req.body;
    
    const existing = await executeQuery('SELECT * FROM reservation_hero_banners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    // Handle image upload from multer
    const imagePath = req.file ? `uploads/reservation-hero/${req.file.filename}` : existing[0].image;
    
    // Delete old image if new one provided
    if (req.file && existing[0].image && existing[0].image !== imagePath) {
      const oldImagePath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }
    
    await executeQuery(`
      UPDATE reservation_hero_banners SET
        eyebrow = ?, title = ?, highlight_text = ?, subtitle = ?,
        button_primary_text = ?, button_primary_url = ?,
        button_secondary_text = ?, button_secondary_url = ?,
        image = ?, stat_1_value = ?, stat_1_label = ?,
        stat_2_value = ?, stat_2_label = ?, stat_3_value = ?, stat_3_label = ?,
        status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      eyebrow || 'TABLE RESERVATIONS',
      title,
      highlight_text,
      subtitle,
      button_primary_text || 'Reserve Table',
      button_primary_url || '#reservation-form',
      button_secondary_text || 'View Outlets',
      button_secondary_url || '/outlets',
      imagePath,
      stat_1_value || '7+',
      stat_1_label || 'Outlets',
      stat_2_value || '30 Days',
      stat_2_label || 'Advance Booking',
      stat_3_value || 'Fast',
      stat_3_label || 'Confirmation',
      status || 'active',
      sort_order || 0,
      id
    ]);
    
    res.json({ success: true, message: 'Banner updated successfully' });
  } catch (error) {
    console.error('Update reservation hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    const existing = await executeQuery('SELECT * FROM reservation_hero_banners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }
    
    // Delete image file
    if (existing[0].image) {
      const imagePath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    await executeQuery('DELETE FROM reservation_hero_banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete reservation hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = {
  getAll,
  getActive,
  getById,
  create,
  update,
  deleteBanner
};
