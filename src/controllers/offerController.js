const { executeQuery } = require('../config/database');

const COLS = 'id, title, description, discount_text, badge_text, label_text, offer_code, start_date, end_date, image, button_text, button_url, status, sort_order, created_at, updated_at';

// GET /api/offers
const getAllOffers = async (req, res) => {
  try {
    const offers = await executeQuery(
      `SELECT ${COLS} FROM offers ORDER BY sort_order ASC, id DESC`
    );
    res.json({ success: true, data: offers });
  } catch (error) {
    console.error('getAllOffers error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/offers/active
const getActiveOffers = async (req, res) => {
  try {
    const offers = await executeQuery(
      `SELECT ${COLS} FROM offers WHERE status = 'active' AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY sort_order ASC, id DESC`
    );
    res.json({ success: true, data: offers });
  } catch (error) {
    console.error('getActiveOffers error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/offers/:id
const getOfferById = async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT ${COLS} FROM offers WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getOfferById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/offers
const createOffer = async (req, res) => {
  try {
    const { title, description, discount_text, badge_text, label_text, offer_code, start_date, end_date, button_text, button_url, status, sort_order } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Offer title is required',
        received_keys: Object.keys(req.body || {})
      });
    }

    const image = req.file ? `uploads/offers/${req.file.filename}` : null;

    const result = await executeQuery(
      `INSERT INTO offers (title, description, discount_text, badge_text, label_text, offer_code, start_date, end_date, image, button_text, button_url, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        description || null,
        discount_text || null,
        badge_text || null,
        label_text || null,
        offer_code || null,
        start_date || null,
        end_date || null,
        image,
        button_text || 'ORDER NOW',
        button_url || 'https://bigbeancafe.store',
        ['active', 'inactive'].includes(status) ? status : 'active',
        parseInt(sort_order) || 0
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Offer created successfully',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('createOffer error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/offers/:id
const updateOffer = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await executeQuery('SELECT id, image FROM offers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    const { title, description, discount_text, badge_text, label_text, offer_code, start_date, end_date, button_text, button_url, status, sort_order } = req.body;

    const allowedFields = ['title', 'description', 'discount_text', 'badge_text', 'label_text', 'offer_code', 'start_date', 'end_date', 'button_text', 'button_url', 'status', 'sort_order'];
    const fields = [];
    const values = [];

    const body = req.body;
    allowedFields.forEach(f => {
      if (body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(body[f] === '' && ['description', 'discount_text', 'badge_text', 'label_text', 'offer_code', 'start_date', 'end_date'].includes(f) ? null : body[f]);
      }
    });

    if (req.file) {
      fields.push('image = ?');
      values.push(`uploads/offers/${req.file.filename}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    values.push(id);
    await executeQuery(`UPDATE offers SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ success: true, message: 'Offer updated successfully' });
  } catch (error) {
    console.error('updateOffer error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/offers/:id
const deleteOffer = async (req, res) => {
  try {
    const existing = await executeQuery('SELECT id FROM offers WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }
    await executeQuery('DELETE FROM offers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('deleteOffer error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getAllOffers,
  getActiveOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer
};
