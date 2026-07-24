const { executeQuery } = require('../config/database');

const COLS = `id, eyebrow, title, subtitle,
  feature_1, feature_2, feature_3, feature_4,
  google_play_url, app_store_url, order_url,
  qr_image, mockup_image, background_image,
  button_text, status, sort_order, created_at, updated_at`;

// Ensure table + default row
const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS app_promos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      eyebrow VARCHAR(100) DEFAULT 'BIG BEAN CAFÉ APP',
      title VARCHAR(255) NOT NULL,
      subtitle TEXT NULL,
      feature_1 VARCHAR(255) NULL,
      feature_2 VARCHAR(255) NULL,
      feature_3 VARCHAR(255) NULL,
      feature_4 VARCHAR(255) NULL,
      google_play_url VARCHAR(500) NULL,
      app_store_url VARCHAR(500) NULL,
      order_url VARCHAR(500) DEFAULT 'https://bigbeancafe.store',
      qr_image VARCHAR(500) NULL,
      mockup_image VARCHAR(500) NULL,
      background_image VARCHAR(500) NULL,
      button_text VARCHAR(100) DEFAULT 'Order Online Now',
      status ENUM('active','inactive') DEFAULT 'active',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const rows = await executeQuery('SELECT COUNT(*) AS cnt FROM app_promos');
  if (rows[0].cnt === 0) {
    await executeQuery(`
      INSERT INTO app_promos
        (eyebrow, title, subtitle, feature_1, feature_2, feature_3, feature_4,
         google_play_url, app_store_url, order_url, button_text, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'BIG BEAN CAFÉ APP',
        'Order on the Go with Big Bean Café App',
        'Download our app for quick ordering, rewards, exclusive offers, and seamless café ordering.',
        'Mobile ordering & payment',
        'Exclusive app-only deals',
        'QR code ordering in-store',
        'Big Coins rewards',
        '#', '#',
        'https://bigbeancafe.store',
        'Order Online Now',
        'active', 1
      ]
    );
  }
};

// Run once on startup
ensureTable().catch(err => console.error('app_promos table init error:', err.message));

// GET /api/app-promos
const getAllAppPromos = async (req, res) => {
  try {
    const rows = await executeQuery(`SELECT ${COLS} FROM app_promos ORDER BY sort_order ASC, id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getAllAppPromos error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/app-promos/active
const getActiveAppPromos = async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT ${COLS} FROM app_promos WHERE status = 'active' ORDER BY sort_order ASC, id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getActiveAppPromos error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/app-promos/:id
const getAppPromoById = async (req, res) => {
  try {
    const rows = await executeQuery(`SELECT ${COLS} FROM app_promos WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'App promo not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getAppPromoById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/app-promos
const createAppPromo = async (req, res) => {
  try {
    const {
      eyebrow, title, subtitle,
      feature_1, feature_2, feature_3, feature_4,
      google_play_url, app_store_url, order_url,
      button_text, status, sort_order
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const files = req.files || {};
    const qr_image = files.qr_image ? `uploads/app-promos/${files.qr_image[0].filename}` : null;
    const mockup_image = files.mockup_image ? `uploads/app-promos/${files.mockup_image[0].filename}` : null;
    const background_image = files.background_image ? `uploads/app-promos/${files.background_image[0].filename}` : null;

    const result = await executeQuery(
      `INSERT INTO app_promos
        (eyebrow, title, subtitle, feature_1, feature_2, feature_3, feature_4,
         google_play_url, app_store_url, order_url, qr_image, mockup_image, background_image,
         button_text, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eyebrow || 'BIG BEAN CAFÉ APP',
        title.trim(),
        subtitle || null,
        feature_1 || null, feature_2 || null, feature_3 || null, feature_4 || null,
        google_play_url || null, app_store_url || null,
        order_url || 'https://bigbeancafe.store',
        qr_image, mockup_image, background_image,
        button_text || 'Order Online Now',
        ['active', 'inactive'].includes(status) ? status : 'active',
        parseInt(sort_order) || 0
      ]
    );

    res.status(201).json({ success: true, message: 'App promo created', data: { id: result.insertId } });
  } catch (error) {
    console.error('createAppPromo error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/app-promos/:id
const updateAppPromo = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM app_promos WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'App promo not found' });

    const allowedFields = [
      'eyebrow', 'title', 'subtitle',
      'feature_1', 'feature_2', 'feature_3', 'feature_4',
      'google_play_url', 'app_store_url', 'order_url',
      'button_text', 'status', 'sort_order'
    ];
    const nullableFields = ['subtitle', 'feature_1', 'feature_2', 'feature_3', 'feature_4', 'google_play_url', 'app_store_url'];

    const fields = [];
    const values = [];
    const body = req.body;

    allowedFields.forEach(f => {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(body[f] === '' && nullableFields.includes(f) ? null : body[f]);
      }
    });

    const files = req.files || {};
    if (files.qr_image) { fields.push('qr_image = ?'); values.push(`uploads/app-promos/${files.qr_image[0].filename}`); }
    if (files.mockup_image) { fields.push('mockup_image = ?'); values.push(`uploads/app-promos/${files.mockup_image[0].filename}`); }
    if (files.background_image) { fields.push('background_image = ?'); values.push(`uploads/app-promos/${files.background_image[0].filename}`); }

    if (fields.length === 0) return res.status(400).json({ success: false, message: 'No fields to update' });

    values.push(id);
    await executeQuery(`UPDATE app_promos SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'App promo updated' });
  } catch (error) {
    console.error('updateAppPromo error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/app-promos/:id
const deleteAppPromo = async (req, res) => {
  try {
    const existing = await executeQuery('SELECT id FROM app_promos WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'App promo not found' });
    await executeQuery('DELETE FROM app_promos WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'App promo deleted' });
  } catch (error) {
    console.error('deleteAppPromo error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getAllAppPromos, getActiveAppPromos, getAppPromoById, createAppPromo, updateAppPromo, deleteAppPromo };
