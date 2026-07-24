const { executeQuery } = require('../config/database');

const BANNERS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS merchandise_banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eyebrow VARCHAR(100) DEFAULT 'BIG BEAN CAFÉ MERCH',
  title VARCHAR(255) NOT NULL,
  subtitle TEXT NULL,
  button_text VARCHAR(100) DEFAULT 'Shop Now',
  button_url VARCHAR(500) DEFAULT '/merchandise',
  image VARCHAR(500) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const ensureBannersTable = async () => {
  try {
    await executeQuery(BANNERS_TABLE_DDL);
  } catch (error) {
    console.error('Ensure banners table error:', error);
  }
};

const safeBannersQuery = async (query, params = []) => {
  await ensureBannersTable();
  try {
    return await executeQuery(query, params);
  } catch (error) {
    console.error('Banners query error:', error);
    return [];
  }
};

// GET all banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await safeBannersQuery('SELECT * FROM merchandise_banners ORDER BY sort_order ASC, id DESC');
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('Get banners error:', error);
    res.json({ success: true, data: [] });
  }
};

// GET active banners only
const getActiveBanners = async (req, res) => {
  try {
    const banners = await safeBannersQuery(
      'SELECT * FROM merchandise_banners WHERE status = ? ORDER BY sort_order ASC, id DESC',
      ['active']
    );
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('Get active banners error:', error);
    res.json({ success: true, data: [] });
  }
};

// GET banner by ID
const getBannerById = async (req, res) => {
  try {
    await ensureBannersTable();
    const { id } = req.params;
    const banners = await executeQuery('SELECT * FROM merchandise_banners WHERE id = ?', [id]);
    if (!banners.length) return res.status(404).json({ success: false, message: 'Banner not found' });
    res.json({ success: true, data: banners[0] });
  } catch (error) {
    console.error('Get banner error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST create banner
const createBanner = async (req, res) => {
  try {
    await ensureBannersTable();
    const { eyebrow, title, subtitle, button_text, button_url, status, sort_order } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const image = req.file ? `uploads/merchandise-banners/${req.file.filename}` : null;

    const result = await executeQuery(
      `INSERT INTO merchandise_banners (eyebrow, title, subtitle, button_text, button_url, image, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eyebrow && eyebrow !== '' ? eyebrow.trim() : 'BIG BEAN CAFÉ MERCH',
        title.trim(),
        subtitle || null,
        button_text && button_text !== '' ? button_text.trim() : 'Shop Now',
        button_url && button_url !== '' ? button_url.trim() : '/merchandise',
        image,
        status || 'active',
        sort_order ? parseInt(sort_order) : 0,
      ]
    );
    res.status(201).json({ success: true, message: 'Banner created', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT update banner
const updateBanner = async (req, res) => {
  try {
    await ensureBannersTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id, image FROM merchandise_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Banner not found' });

    const { eyebrow, title, subtitle, button_text, button_url, status, sort_order } = req.body;
    const sets = [];
    const vals = [];
    const s = (col, v) => { sets.push(`${col} = ?`); vals.push(v); };

    if (eyebrow !== undefined) s('eyebrow', eyebrow && eyebrow !== '' ? eyebrow.trim() : 'BIG BEAN CAFÉ MERCH');
    if (title !== undefined) s('title', title.trim());
    if (subtitle !== undefined) s('subtitle', subtitle || null);
    if (button_text !== undefined) s('button_text', button_text && button_text !== '' ? button_text.trim() : 'Shop Now');
    if (button_url !== undefined) s('button_url', button_url && button_url !== '' ? button_url.trim() : '/merchandise');
    if (status !== undefined) s('status', status);
    if (sort_order !== undefined) s('sort_order', parseInt(sort_order) || 0);
    if (req.file) s('image', `uploads/merchandise-banners/${req.file.filename}`);

    if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    vals.push(id);
    await executeQuery(`UPDATE merchandise_banners SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true, message: 'Banner updated' });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE banner
const deleteBanner = async (req, res) => {
  try {
    await ensureBannersTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM merchandise_banners WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Banner not found' });
    await executeQuery('DELETE FROM merchandise_banners WHERE id = ?', [id]);
    res.json({ success: true, message: 'Banner deleted' });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getAllBanners,
  getActiveBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};
