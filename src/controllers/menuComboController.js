const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS menu_combos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      subtitle VARCHAR(255) NULL,
      description TEXT NULL,
      items_text TEXT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      mrp DECIMAL(10,2) NULL,
      badge_text VARCHAR(100) DEFAULT 'Chef Recommended',
      image VARCHAR(500) NULL,
      button_text VARCHAR(100) DEFAULT 'Order Combo',
      button_url VARCHAR(500) DEFAULT 'https://bigbeancafe.store',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM menu_combos');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO menu_combos
        (title, subtitle, description, items_text, price, mrp, badge_text, button_text, button_url, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'The Big Bean Combo',
      'Signature Coffee + Sandwich + Dessert',
      'A perfect café combo crafted for coffee lovers.',
      '1 Signature Coffee + 1 Sandwich + 1 Dessert',
      499, 607,
      'Chef Recommended',
      'Order Combo', 'https://bigbeancafe.store',
      'active', 1
    ]);
  }
};

ensureTable().catch(err => console.error('menu_combos table init error:', err));

const getAll = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM menu_combos ORDER BY sort_order ASC, created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAll menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getActive = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT * FROM menu_combos WHERE status = ? ORDER BY sort_order ASC, created_at DESC',
      ['active']
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getActive menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req, res) => {
  try {
    const rows = await executeQuery('SELECT * FROM menu_combos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getById menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req, res) => {
  try {
    const { title, subtitle, description, items_text, price, mrp, badge_text, button_text, button_url, status, sort_order } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    if (!price) return res.status(400).json({ success: false, message: 'Price is required' });
    const image = req.file ? `uploads/menu-combos/${req.file.filename}` : null;
    const result = await executeQuery(`
      INSERT INTO menu_combos
        (title, subtitle, description, items_text, price, mrp, badge_text, image, button_text, button_url, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title.trim(), subtitle || null, description || null, items_text || null,
      parseFloat(price) || 0, mrp ? parseFloat(mrp) : null,
      badge_text || 'Chef Recommended', image,
      button_text || 'Order Combo', button_url || 'https://bigbeancafe.store',
      status || 'active', parseInt(sort_order) || 0
    ]);
    res.status(201).json({ success: true, message: 'Created successfully', data: { id: result.insertId } });
  } catch (err) {
    console.error('create menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM menu_combos WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const { title, subtitle, description, items_text, price, mrp, badge_text, button_text, button_url, status, sort_order } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    let image = existing[0].image;
    if (req.file) {
      if (image && !image.startsWith('http')) {
        const oldPath = path.join(__dirname, '../', image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = `uploads/menu-combos/${req.file.filename}`;
    }
    await executeQuery(`
      UPDATE menu_combos SET
        title=?, subtitle=?, description=?, items_text=?,
        price=?, mrp=?, badge_text=?, image=?,
        button_text=?, button_url=?, status=?, sort_order=?, updated_at=NOW()
      WHERE id=?
    `, [
      title.trim(), subtitle || null, description || null, items_text || null,
      parseFloat(price) || 0, mrp ? parseFloat(mrp) : null,
      badge_text || 'Chef Recommended', image,
      button_text || 'Order Combo', button_url || 'https://bigbeancafe.store',
      status || 'active', parseInt(sort_order) || 0, id
    ]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('update menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM menu_combos WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });
    const image = existing[0].image;
    if (image && !image.startsWith('http')) {
      const filePath = path.join(__dirname, '../', image);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await executeQuery('DELETE FROM menu_combos WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('delete menu-combos error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
