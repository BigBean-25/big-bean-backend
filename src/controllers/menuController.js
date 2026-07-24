const { executeQuery } = require('../config/database');

// Get all menu items
const getAllMenuItems = async (req, res) => {
  try {
    const { category, search, status } = req.query;
    
    let query = `
      SELECT 
        mi.id,
        mi.category_id,
        mi.name,
        mi.description,
        mi.price,
        mi.image,
        mi.status,
        mi.sort_order,
        mi.created_at,
        mi.updated_at,
        mc.name AS category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
    `;
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (category && category !== 'all') {
      whereConditions.push('mi.category_id = ?');
      params.push(category);
    }
    
    if (status && status !== 'all') {
      whereConditions.push('mi.status = ?');
      params.push(status);
    } else {
      whereConditions.push('mi.status = ?');
      params.push('active');
    }
    
    if (search) {
      whereConditions.push('(mi.name LIKE ? OR mi.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY mc.sort_order ASC, mi.sort_order ASC, mi.name ASC';
    
    const menuItems = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: menuItems,
      message: menuItems.length === 0 ? 'No menu items found' : 'Menu items retrieved successfully'
    });
    
  } catch (error) {
    console.error('Menu API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get menu item by ID
const getMenuItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const menuItem = await executeQuery(
      `SELECT 
        mi.id,
        mi.category_id,
        mi.name,
        mi.description,
        mi.price,
        mi.image,
        mi.status,
        mi.sort_order,
        mi.created_at,
        mi.updated_at,
        mc.name AS category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.id = ?`,
      [id]
    );
    
    if (menuItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    res.json({
      success: true,
      data: menuItem[0]
    });
    
  } catch (error) {
    console.error('Menu API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new menu item
const createMenuItem = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      price,
      original_price,
      image_url,
      ingredients,
      nutritional_info,
      allergens,
      preparation_time,
      spicy_level,
      vegetarian,
      status,
      sort_order,
      featured
    } = req.body;
    
    // Validate required fields
    if (!name || !category || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, category, and price are required'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO menu_items (
        name, description, category, price, original_price, image_url,
        ingredients, nutritional_info, allergens, preparation_time,
        spicy_level, vegetarian, status, sort_order, featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, description, category, price, original_price, image_url,
        ingredients, nutritional_info, allergens, preparation_time,
        spicy_level, vegetarian || false, status || 'active', sort_order || 0, featured || false
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update menu item
const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if menu item exists
    const existingItem = await executeQuery(
      'SELECT id FROM menu_items WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = [
      'name', 'description', 'category', 'price', 'original_price', 'image_url',
      'ingredients', 'nutritional_info', 'allergens', 'preparation_time',
      'spicy_level', 'vegetarian', 'status', 'sort_order', 'featured'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    updateValues.push(id);
    
    await executeQuery(
      `UPDATE menu_items SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: 'Menu item updated successfully'
    });
    
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete menu item
const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if menu item exists
    const existingItem = await executeQuery(
      'SELECT id FROM menu_items WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM menu_items WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle menu item status
const toggleMenuItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }
    
    // Check if menu item exists
    const existingItem = await executeQuery(
      'SELECT id FROM menu_items WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found'
      });
    }
    
    await executeQuery(
      'UPDATE menu_items SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      success: true,
      message: 'Menu item status updated successfully'
    });
    
  } catch (error) {
    console.error('Toggle menu item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get menu categories
const getMenuCategories = async (req, res) => {
  try {
    const categories = await executeQuery(
      `SELECT 
        id,
        name,
        description,
        image,
        status,
        sort_order,
        created_at,
        updated_at
      FROM menu_categories
      WHERE status = 'active'
      ORDER BY sort_order ASC, name ASC`
    );
    
    res.json({
      success: true,
      data: categories,
      message: categories.length === 0 ? 'No categories found' : 'Categories retrieved successfully'
    });
    
  } catch (error) {
    console.error('Menu API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllMenuItems,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemStatus,
  getMenuCategories
};
