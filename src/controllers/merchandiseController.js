const { executeQuery } = require('../config/database');

const makeSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const MERCHANDISE_TABLE_DDL = `CREATE TABLE IF NOT EXISTS merchandise (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  mrp DECIMAL(10,2) NULL,
  sku VARCHAR(100) NULL,
  stock INT DEFAULT 0,
  image VARCHAR(500) NULL,
  rating DECIMAL(2,1) DEFAULT 4.8,
  badge_text VARCHAR(255) NULL,
  category VARCHAR(255) NULL,
  category_id INT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const CATEGORIES_TABLE_DDL = `CREATE TABLE IF NOT EXISTS merchandise_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NULL,
  description TEXT NULL,
  icon VARCHAR(100) NULL,
  image VARCHAR(500) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`;

const safeAddColumn = async (table, column, definition) => {
  const cols = await executeQuery(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
  if (!cols.length) {
    await executeQuery(`ALTER TABLE \`${table}\` ADD COLUMN ${column} ${definition}`);
  }
};

const ensureMerchandiseSchema = async () => {
  try {
    await executeQuery(CATEGORIES_TABLE_DDL);
    await safeAddColumn('merchandise_categories', 'slug',        'VARCHAR(100) NULL AFTER name');
    await safeAddColumn('merchandise_categories', 'icon',        'VARCHAR(50) NULL AFTER description');
    await executeQuery(MERCHANDISE_TABLE_DDL);
    await safeAddColumn('merchandise', 'rating',      'DECIMAL(2,1) DEFAULT 4.8 AFTER image');
    await safeAddColumn('merchandise', 'badge_text',  'VARCHAR(255) NULL AFTER rating');
    await safeAddColumn('merchandise', 'category',    'VARCHAR(255) NULL AFTER badge_text');
    await safeAddColumn('merchandise', 'category_id', 'INT NULL AFTER category');
  } catch (error) {
    console.error('Ensure merchandise schema error:', error);
  }
};

const getSelectCols = () => `
  m.*,
  m.stock AS stock_quantity,
  c.name AS category_name,
  c.slug AS category_slug,
  c.icon AS category_icon
`;

const getJoin = () => ` LEFT JOIN merchandise_categories c ON m.category_id = c.id `;

const safeMerchandiseQuery = async (query, params = []) => {
  await ensureMerchandiseSchema();
  try {
    return await executeQuery(query, params);
  } catch (error) {
    console.error('Merchandise query error:', error);
    return [];
  }
};

// Get all merchandise products
const getAllMerchandise = async (req, res) => {
  try {
    const { category, status, search, category_id } = req.query;
    let query = 'SELECT ' + getSelectCols() + ' FROM merchandise m' + getJoin();
    const params = [];
    const where = [];
    if (category_id && category_id !== 'all') { where.push('m.category_id = ?'); params.push(category_id); }
    if (category && category !== 'all') { where.push('(m.category = ? OR c.slug = ?)'); params.push(category, category); }
    if (status && status !== 'all') { where.push('m.status = ?'); params.push(status); }
    if (search) { where.push('(m.name LIKE ? OR m.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (where.length) query += ' WHERE ' + where.join(' AND ');
    query += ' ORDER BY m.sort_order ASC, m.id DESC';
    const merchandise = await safeMerchandiseQuery(query, params);
    res.json({ success: true, data: merchandise });
  } catch (error) {
    console.error('Get all merchandise error:', error);
    res.json({ success: true, data: [] });
  }
};

// Get merchandise product by ID
const getMerchandiseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await safeMerchandiseQuery(
      'SELECT ' + getSelectCols() + ' FROM merchandise m' + getJoin() + ' WHERE m.id = ?',
      [id]
    );
    
    if (product.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Merchandise product not found'
      });
    }
    
    res.json({
      success: true,
      data: product[0]
    });
    
  } catch (error) {
    console.error('Get merchandise by ID error:', error);
    res.json({ success: true, data: null });
  }
};

// Get active merchandise for public display
const getActiveMerchandise = async (req, res) => {
  try {
    const { category_id, category } = req.query;
    let query = 'SELECT ' + getSelectCols() + ' FROM merchandise m' + getJoin() + ' WHERE m.status = ?';
    const params = ['active'];
    if (category_id && category_id !== 'all') { query += ' AND m.category_id = ?'; params.push(category_id); }
    if (category && category !== 'all') { query += ' AND (m.category = ? OR c.slug = ?)'; params.push(category, category); }
    query += ' ORDER BY m.sort_order ASC, m.id DESC';
    const products = await safeMerchandiseQuery(query, params);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Get active merchandise error:', error);
    res.json({ success: true, data: [] });
  }
};

// Get merchandise by slug
const getMerchandiseBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const rows = await safeMerchandiseQuery(
      'SELECT ' + getSelectCols() + ' FROM merchandise m' + getJoin() + ' WHERE m.slug = ?',
      [slug]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Get merchandise by slug error:', error);
    res.json({ success: true, data: null });
  }
};

// Create new merchandise product
const createMerchandise = async (req, res) => {
  try {
    await ensureMerchandiseSchema();
    const { name, description, price, mrp, sku, stock, rating, badge_text, category, category_id, status, sort_order } = req.body;
    if (!name || price === undefined || price === '') {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }
    const rawSlug = req.body.slug && req.body.slug.trim()
      ? req.body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : makeSlug(name) + '-' + Date.now();
    const dupCheck = await executeQuery('SELECT id FROM merchandise WHERE slug = ?', [rawSlug]);
    const finalSlug = dupCheck.length ? rawSlug + '-' + Date.now() : rawSlug;
    const image = req.file ? `uploads/merchandise/${req.file.filename}` : null;
    const parsedCategoryId = category_id && category_id !== '' ? parseInt(category_id) : null;
    const result = await executeQuery(
      `INSERT INTO merchandise (name, slug, description, price, mrp, sku, stock, image, rating, badge_text, category, category_id, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        finalSlug,
        description || null,
        parseFloat(price),
        mrp && mrp !== '' ? parseFloat(mrp) : null,
        sku && sku !== '' ? sku.trim() : null,
        stock ? parseInt(stock) : 0,
        image,
        rating ? parseFloat(rating) : 4.8,
        badge_text && badge_text !== '' ? badge_text.trim() : null,
        category && category !== '' ? category.trim() : null,
        parsedCategoryId,
        status || 'active',
        sort_order ? parseInt(sort_order) : 0,
      ]
    );
    res.status(201).json({ success: true, message: 'Product created', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create merchandise error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update merchandise product
const updateMerchandise = async (req, res) => {
  try {
    await ensureMerchandiseSchema();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id, image FROM merchandise WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Product not found' });

    const { name, slug, description, price, mrp, sku, stock, rating, badge_text, category, category_id, status, sort_order } = req.body;
    const sets = [];
    const vals = [];

    const s = (col, v) => { sets.push(`${col} = ?`); vals.push(v); };

    if (name !== undefined) s('name', name.trim());
    if (slug !== undefined) {
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (cleanSlug) {
        const dup = await executeQuery('SELECT id FROM merchandise WHERE slug = ? AND id != ?', [cleanSlug, id]);
        if (dup.length) return res.status(409).json({ success: false, message: 'Slug already exists. Please choose another slug.' });
        s('slug', cleanSlug);
      }
    } else if (name !== undefined) {
      s('slug', makeSlug(name) + '-' + id);
    }
    if (description !== undefined) s('description', description || null);
    if (price !== undefined) s('price', parseFloat(price));
    if (mrp !== undefined) s('mrp', mrp && mrp !== '' ? parseFloat(mrp) : null);
    if (sku !== undefined) s('sku', sku && sku !== '' ? sku.trim() : null);
    if (stock !== undefined) s('stock', parseInt(stock) || 0);
    if (rating !== undefined) s('rating', parseFloat(rating) || 4.8);
    if (badge_text !== undefined) s('badge_text', badge_text && badge_text !== '' ? badge_text.trim() : null);
    if (category !== undefined) s('category', category && category !== '' ? category.trim() : null);
    if (category_id !== undefined) s('category_id', category_id && category_id !== '' ? parseInt(category_id) : null);
    if (status !== undefined) s('status', status);
    if (sort_order !== undefined) s('sort_order', parseInt(sort_order) || 0);
    if (req.file) s('image', `uploads/merchandise/${req.file.filename}`);

    if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    vals.push(id);
    await executeQuery(`UPDATE merchandise SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true, message: 'Product updated' });
  } catch (error) {
    console.error('Update merchandise error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete merchandise product
const deleteMerchandise = async (req, res) => {
  try {
    await ensureMerchandiseSchema();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM merchandise WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Product not found' });
    await executeQuery('DELETE FROM merchandise WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    console.error('Delete merchandise error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getAllMerchandise,
  getMerchandiseById,
  getMerchandiseBySlug,
  getActiveMerchandise,
  createMerchandise,
  updateMerchandise,
  deleteMerchandise,
};
