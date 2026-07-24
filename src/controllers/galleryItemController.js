const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'general',
      media_type ENUM('image','video','instagram') DEFAULT 'image',
      image VARCHAR(500) NULL,
      video VARCHAR(500) NULL,
      instagram_url VARCHAR(800) NULL,
      description TEXT NULL,
      tags VARCHAR(500) NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      is_featured TINYINT(1) DEFAULT 0,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const { category, media_type, search, status } = req.query;
    let query = 'SELECT * FROM gallery_items WHERE 1=1';
    const params = [];

    if (status) { query += ' AND status = ?'; params.push(status); }
    if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
    if (media_type && media_type !== 'all') { query += ' AND media_type = ?'; params.push(media_type); }
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';
    const items = await executeQuery(query, params);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get gallery items error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const { category, media_type, search } = req.query;
    let query = "SELECT * FROM gallery_items WHERE status = 'active'";
    const params = [];

    if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
    if (media_type && media_type !== 'all') { query += ' AND media_type = ?'; params.push(media_type); }
    if (search) {
      query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY is_featured DESC, sort_order ASC, id DESC';
    const items = await executeQuery(query, params);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get active gallery items error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const rows = await executeQuery('SELECT * FROM gallery_items WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get gallery item by ID error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const create = async (req, res) => {
  try {
    await ensureTable();
    const {
      title, category, media_type, instagram_url,
      description, tags, status, is_featured, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const imagePath = req.files?.image?.[0] ? `uploads/gallery/${req.files.image[0].filename}` : null;
    const videoPath = req.files?.video?.[0] ? `uploads/gallery/${req.files.video[0].filename}` : null;

    const result = await executeQuery(`
      INSERT INTO gallery_items
        (title, category, media_type, image, video, instagram_url,
         description, tags, status, is_featured, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [
      title, category || 'general', media_type || 'image',
      imagePath, videoPath, instagram_url || null,
      description || null, tags || null,
      status || 'active', is_featured ? 1 : 0, sort_order || 0
    ]);

    res.status(201).json({ success: true, message: 'Gallery item created', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create gallery item error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const {
      title, category, media_type, instagram_url,
      description, tags, status, is_featured, sort_order
    } = req.body;

    const existing = await executeQuery('SELECT * FROM gallery_items WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });

    const imagePath = req.files?.image?.[0]
      ? `uploads/gallery/${req.files.image[0].filename}`
      : existing[0].image;
    const videoPath = req.files?.video?.[0]
      ? `uploads/gallery/${req.files.video[0].filename}`
      : existing[0].video;

    if (req.files?.image?.[0] && existing[0].image) {
      const old = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    if (req.files?.video?.[0] && existing[0].video) {
      const old = path.join(__dirname, '../', existing[0].video);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    await executeQuery(`
      UPDATE gallery_items SET
        title=?, category=?, media_type=?, image=?, video=?, instagram_url=?,
        description=?, tags=?, status=?, is_featured=?, sort_order=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [
      title, category || 'general', media_type || 'image',
      imagePath, videoPath, instagram_url || null,
      description || null, tags || null,
      status || 'active', is_featured ? 1 : 0, sort_order || 0, id
    ]);

    res.json({ success: true, message: 'Gallery item updated' });
  } catch (error) {
    console.error('Update gallery item error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const deleteItem = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM gallery_items WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'Item not found' });

    if (existing[0].image) {
      const p = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    if (existing[0].video) {
      const p = path.join(__dirname, '../', existing[0].video);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await executeQuery('DELETE FROM gallery_items WHERE id = ?', [id]);
    res.json({ success: true, message: 'Gallery item deleted' });
  } catch (error) {
    console.error('Delete gallery item error:', error);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

module.exports = { getAll, getActive, getById, create, update, deleteItem };
