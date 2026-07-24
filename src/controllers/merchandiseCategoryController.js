const { executeQuery } = require('../config/database');

const makeSlug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

const ensureCategoriesTable = async () => {
  try {
    await executeQuery(CATEGORIES_TABLE_DDL);
    await executeQuery("ALTER TABLE merchandise_categories ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE NULL AFTER name");
    await executeQuery("ALTER TABLE merchandise_categories ADD COLUMN IF NOT EXISTS icon VARCHAR(100) NULL AFTER description");
  } catch (error) {
    console.error('Ensure categories table error:', error);
  }
};

const safeCategoriesQuery = async (query, params = []) => {
  await ensureCategoriesTable();
  try {
    return await executeQuery(query, params);
  } catch (error) {
    console.error('Categories query error:', error);
    return [];
  }
};

const getUniqueSlug = async (name, excludeId = null) => {
  let baseSlug = makeSlug(name);
  if (!baseSlug) return null;
  let slug = baseSlug;
  let attempts = 0;
  while (true) {
    const query = excludeId
      ? 'SELECT id FROM merchandise_categories WHERE slug = ? AND id != ?'
      : 'SELECT id FROM merchandise_categories WHERE slug = ?';
    const params = excludeId ? [slug, excludeId] : [slug];
    const existing = await safeCategoriesQuery(query, params);
    if (!existing.length) return slug;
    slug = `${baseSlug}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    attempts += 1;
    if (attempts > 5) return `${baseSlug}-${Date.now()}`;
  }
};

// GET all categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await safeCategoriesQuery('SELECT * FROM merchandise_categories ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.json({ success: true, data: [] });
  }
};

// GET active categories only
const getActiveCategories = async (req, res) => {
  try {
    const categories = await safeCategoriesQuery(
      'SELECT * FROM merchandise_categories WHERE status = ? ORDER BY sort_order ASC, id ASC',
      ['active']
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get active categories error:', error);
    res.json({ success: true, data: [] });
  }
};

// GET category by ID
const getCategoryById = async (req, res) => {
  try {
    await ensureCategoriesTable();
    const { id } = req.params;
    const categories = await executeQuery('SELECT * FROM merchandise_categories WHERE id = ?', [id]);
    if (!categories.length) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: categories[0] });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST create category
const createCategory = async (req, res) => {
  try {
    await ensureCategoriesTable();
    const name = req.body?.name;
    const description = req.body?.description;
    const icon = req.body?.icon;
    const status = req.body?.status;
    const sort_order = req.body?.sort_order;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required',
        received_keys: Object.keys(req.body || {})
      });
    }

    const slug = await getUniqueSlug(name);
    const image = req.file ? `uploads/merchandise-categories/${req.file.filename}` : null;
    const trimmedIcon = typeof icon === 'string' && icon.trim() !== '' ? icon.trim() : null;

    const result = await executeQuery(
      `INSERT INTO merchandise_categories (name, slug, description, icon, image, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        slug,
        typeof description === 'string' && description.trim() !== '' ? description.trim() : null,
        trimmedIcon,
        image,
        typeof status === 'string' && status.trim() !== '' ? status.trim() : 'active',
        sort_order !== undefined && sort_order !== '' ? parseInt(sort_order) || 0 : 0,
      ]
    );
    res.status(201).json({ success: true, message: 'Category created', data: { id: result.insertId } });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create merchandise category',
      error: error.message
    });
  }
};

// PUT update category
const updateCategory = async (req, res) => {
  try {
    await ensureCategoriesTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id, image FROM merchandise_categories WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Category not found' });

    const { name, description, icon, status, sort_order } = req.body;
    const sets = [];
    const vals = [];
    const s = (col, v) => { sets.push(`${col} = ?`); vals.push(v); };

    if (name !== undefined && name.trim() !== '') {
      s('name', name.trim());
      s('slug', await getUniqueSlug(name, id));
    }
    if (description !== undefined) s('description', description && description.trim() !== '' ? description.trim() : null);
    if (icon !== undefined) s('icon', icon && icon.trim() !== '' ? icon.trim() : null);
    if (status !== undefined) s('status', status && status.trim() !== '' ? status.trim() : 'active');
    if (sort_order !== undefined) s('sort_order', sort_order !== '' ? parseInt(sort_order) || 0 : 0);
    if (req.file) s('image', `uploads/merchandise-categories/${req.file.filename}`);

    if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
    vals.push(id);
    await executeQuery(`UPDATE merchandise_categories SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ success: true, message: 'Category updated' });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ success: false, message: 'Failed to update merchandise category', error: error.message });
  }
};

// DELETE category
const deleteCategory = async (req, res) => {
  try {
    await ensureCategoriesTable();
    const { id } = req.params;
    const existing = await executeQuery('SELECT id FROM merchandise_categories WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Category not found' });
    await executeQuery('DELETE FROM merchandise_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete merchandise category', error: error.message });
  }
};

module.exports = {
  getAllCategories,
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
