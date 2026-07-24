const { executeQuery } = require('../config/database');
const fs = require('fs');
const path = require('path');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS event_hero_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(150) DEFAULT 'Big Bean Café',
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      button_text VARCHAR(100) DEFAULT 'Explore Events',
      button_link VARCHAR(500) DEFAULT '/events',
      image VARCHAR(500) NULL,
      overlay_opacity DECIMAL(3,2) DEFAULT 0.60,
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) as cnt FROM event_hero_sections');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO event_hero_sections
        (eyebrow, title, subtitle, button_text, button_link, overlay_opacity, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?)
    `, [
      'Big Bean Café',
      'Big Bean Cafe Events',
      'Workshops, live nights, community meetups and café experiences.',
      'Explore Events',
      '/events',
      0.60,
      'active',
      1
    ]);
  }
};

const getAll = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM event_hero_sections ORDER BY sort_order ASC, id DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getActive = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery(
      "SELECT * FROM event_hero_sections WHERE status='active' ORDER BY sort_order ASC, id DESC LIMIT 1"
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getById = async (req, res) => {
  try {
    await ensureTable();
    const rows = await executeQuery('SELECT * FROM event_hero_sections WHERE id=?', [req.params.id]);
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
      eyebrow, title, subtitle, button_text, button_link,
      overlay_opacity, status, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const image = req.file ? `uploads/events-hero/${req.file.filename}` : null;
    const opacity = overlay_opacity ? parseFloat(overlay_opacity) : 0.60;

    const result = await executeQuery(`
      INSERT INTO event_hero_sections
        (eyebrow, title, subtitle, button_text, button_link, image, overlay_opacity, status, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      eyebrow || 'Big Bean Café',
      title,
      subtitle || null,
      button_text || 'Explore Events',
      button_link || '/events',
      image,
      opacity,
      status || 'active',
      sort_order ? parseInt(sort_order) : 0
    ]);

    res.json({ success: true, message: 'Created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const update = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const {
      eyebrow, title, subtitle, button_text, button_link,
      overlay_opacity, status, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const existing = await executeQuery('SELECT * FROM event_hero_sections WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Not found' });

    let image = existing[0].image;
    if (req.file) {
      if (image) {
        const oldPath = path.join(__dirname, '../', image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image = `uploads/events-hero/${req.file.filename}`;
    }

    const opacity = overlay_opacity ? parseFloat(overlay_opacity) : 0.60;

    await executeQuery(`
      UPDATE event_hero_sections SET
        eyebrow = ?, title = ?, subtitle = ?, button_text = ?, button_link = ?,
        image = ?, overlay_opacity = ?, status = ?, sort_order = ?
      WHERE id = ?
    `, [
      eyebrow || 'Big Bean Café',
      title,
      subtitle || null,
      button_text || 'Explore Events',
      button_link || '/events',
      image,
      opacity,
      status || 'active',
      sort_order ? parseInt(sort_order) : 0,
      id
    ]);

    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT * FROM event_hero_sections WHERE id = ?', [id]);
    if (existing.length && existing[0].image) {
      const oldPath = path.join(__dirname, '../', existing[0].image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await executeQuery('DELETE FROM event_hero_sections WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAll, getActive, getById, create, update, remove };
