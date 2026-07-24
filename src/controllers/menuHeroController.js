const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS menu_hero_banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'BIG BEAN CAFÉ MENU',
      title VARCHAR(255) NOT NULL,
      highlight_text VARCHAR(255) NULL,
      subtitle TEXT NULL,
      button_primary_text VARCHAR(100) DEFAULT 'Order Online',
      button_primary_url VARCHAR(500) DEFAULT 'https://bigbeancafe.store',
      button_secondary_text VARCHAR(100) DEFAULT 'Explore Menu',
      button_secondary_url VARCHAR(500) DEFAULT '#menu-products',
      image VARCHAR(500) NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM menu_hero_banners');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO menu_hero_banners
        (eyebrow, title, highlight_text, subtitle,
         button_primary_text, button_primary_url,
         button_secondary_text, button_secondary_url,
         status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'BIG BEAN CAFÉ MENU',
      'Crafted Coffee, Fresh Food',
      'Café Favourites',
      'Explore our live menu with handcrafted beverages, fresh bites, desserts and signature Big Bean Café favourites.',
      'Order Online', 'https://bigbeancafe.store',
      'Explore Menu', '#menu-products',
      'active', 1
    ]);
  }
};

ensureTable().catch(err => console.error('menu_hero_banners table init error:', err));

const getAll = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM menu_hero_banners ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAll menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getActive = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM menu_hero_banners WHERE status = ? ORDER BY sort_order ASC, created_at DESC LIMIT 1',
      ['active']
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    console.error('getActive menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM menu_hero_banners WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getById menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { eyebrow, title, highlight_text, subtitle, button_primary_text, button_primary_url, button_secondary_text, button_secondary_url, status, sort_order } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    const image = req.file ? `uploads/menu-hero/${req.file.filename}` : null;
    const result = await executeQuery(`
      INSERT INTO menu_hero_banners
        (eyebrow, title, highlight_text, subtitle, button_primary_text, button_primary_url, button_secondary_text, button_secondary_url, image, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      eyebrow || 'BIG BEAN CAFÉ MENU', title.trim(), highlight_text || null, subtitle || null,
      button_primary_text || 'Order Online', button_primary_url || 'https://bigbeancafe.store',
      button_secondary_text || 'Explore Menu', button_secondary_url || '#menu-products',
      image, status || 'active', parseInt(sort_order) || 0
    ]);
    res.status(201).json({ success: true, message: 'Created successfully', data: { id: result.insertId } });
  } catch (err) {
    console.error('create menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM menu_hero_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const { eyebrow, title, highlight_text, subtitle, button_primary_text, button_primary_url, button_secondary_text, button_secondary_url, status, sort_order } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    let image = existing[0].image;
    if (req.file) {
      if (image && !image.startsWith('http')) {
        const oldPath = path.join(__dirname, '../', image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = `uploads/menu-hero/${req.file.filename}`;
    }
    await executeQuery(`
      UPDATE menu_hero_banners SET
        eyebrow=?, title=?, highlight_text=?, subtitle=?,
        button_primary_text=?, button_primary_url=?,
        button_secondary_text=?, button_secondary_url=?,
        image=?, status=?, sort_order=?, updated_at=NOW()
      WHERE id=?
    `, [
      eyebrow || 'BIG BEAN CAFÉ MENU', title.trim(), highlight_text || null, subtitle || null,
      button_primary_text || 'Order Online', button_primary_url || 'https://bigbeancafe.store',
      button_secondary_text || 'Explore Menu', button_secondary_url || '#menu-products',
      image, status || 'active', parseInt(sort_order) || 0, id
    ]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('update menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM menu_hero_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const image = existing[0].image;
    if (image && !image.startsWith('http')) {
      const filePath = path.join(__dirname, '../', image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await executeQuery('DELETE FROM menu_hero_banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('delete menu-hero error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
