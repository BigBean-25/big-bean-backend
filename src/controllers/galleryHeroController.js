const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS gallery_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'BIG BEAN CAFÉ GALLERY',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Explore Gallery',
      button_primary_url VARCHAR(500) DEFAULT '#gallery-list',
      button_secondary_text VARCHAR(100) DEFAULT 'Follow Instagram',
      button_secondary_url VARCHAR(500) DEFAULT 'https://www.instagram.com/bigbeancafe.in/',
      image VARCHAR(500) NULL,
      stat_1_value VARCHAR(50) DEFAULT 'Reels',
      stat_1_label VARCHAR(100) DEFAULT 'Café Moments',
      stat_2_value VARCHAR(50) DEFAULT 'Events',
      stat_2_label VARCHAR(100) DEFAULT 'Workshops',
      stat_3_value VARCHAR(50) DEFAULT 'Outlets',
      stat_3_label VARCHAR(100) DEFAULT 'Good Vibes',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM gallery_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO gallery_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         stat_1_value, stat_1_label, stat_2_value, stat_2_label,
         stat_3_value, stat_3_label, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      'BIG BEAN CAFÉ GALLERY',
      'Moments Brewed',
      'at Big Bean Café',
      'Explore our café stories, Instagram reels, outlet moments, events, coffee creations and community memories.',
      'Explore Gallery', '#gallery-list',
      'Follow Instagram', 'https://www.instagram.com/bigbeancafe.in/',
      'Reels', 'Café Moments', 'Events', 'Workshops',
      'Outlets', 'Good Vibes', 'active', 1
    ]);
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const banners = await executeQuery('SELECT * FROM gallery_hero_banners ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('Get gallery hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const banners = await executeQuery(
      "SELECT * FROM gallery_hero_banners WHERE status = 'active' ORDER BY sort_order ASC, id ASC LIMIT 1"
    );
    res.json({ success: true, data: banners[0] || null });
  } catch (error) {
    console.error('Get active gallery hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const banner = await executeQuery('SELECT * FROM gallery_hero_banners WHERE id = ?', [id]);
    if (banner.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: banner[0] });
  } catch (error) {
    console.error('Get gallery hero by ID error:', error);
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

    const imagePath = req.file ? `uploads/gallery-hero/${req.file.filename}` : null;

    const result = await executeQuery(`
      INSERT INTO gallery_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         image, stat_1_value, stat_1_label,
         stat_2_value, stat_2_label, stat_3_value, stat_3_label,
         status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'BIG BEAN CAFÉ GALLERY', title, highlight_text, subtitle,
      button_primary_text || 'Explore Gallery', button_primary_url || '#gallery-list',
      button_secondary_text || 'Follow Instagram', button_secondary_url || 'https://www.instagram.com/bigbeancafe.in/',
      imagePath,
      stat_1_value || 'Reels', stat_1_label || 'Café Moments',
      stat_2_value || 'Events', stat_2_label || 'Workshops',
      stat_3_value || 'Outlets', stat_3_label || 'Good Vibes',
      status || 'active', sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Banner created successfully', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create gallery hero error:', error);
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

    const existing = await executeQuery('SELECT * FROM gallery_hero_banners WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });

    const imagePath = req.file ? `uploads/gallery-hero/${req.file.filename}` : existing[0].image;

    if (req.file && existing[0].image) {
      const oldPath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    await executeQuery(`
      UPDATE gallery_hero_banners SET
        eyebrow=?, title=?, highlight_text=?, subtitle=?,
        button_primary_text=?, button_primary_url=?,
        button_secondary_text=?, button_secondary_url=?,
        image=?, stat_1_value=?, stat_1_label=?,
        stat_2_value=?, stat_2_label=?, stat_3_value=?, stat_3_label=?,
        status=?, sort_order=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [
      eyebrow || 'BIG BEAN CAFÉ GALLERY', title, highlight_text, subtitle,
      button_primary_text || 'Explore Gallery', button_primary_url || '#gallery-list',
      button_secondary_text || 'Follow Instagram', button_secondary_url || 'https://www.instagram.com/bigbeancafe.in/',
      imagePath,
      stat_1_value || 'Reels', stat_1_label || 'Café Moments',
      stat_2_value || 'Events', stat_2_label || 'Workshops',
      stat_3_value || 'Outlets', stat_3_label || 'Good Vibes',
      status || 'active', sort_order || 0, id
    ]);

    res.json({ success: true, message: 'Banner updated successfully' });
  } catch (error) {
    console.error('Update gallery hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deleteBanner = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM gallery_hero_banners WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Banner not found' });

    if (existing[0].image) {
      const imgPath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await executeQuery('DELETE FROM gallery_hero_banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Delete gallery hero error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getAll, getActive, getById, create, update, deleteBanner };
