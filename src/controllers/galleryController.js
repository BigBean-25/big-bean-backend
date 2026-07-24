const { executeQuery } = require('../config/database');

// Get all gallery items
const getAllGalleryItems = async (req, res) => {
  try {
    const { category, type, status, search } = req.query;
    
    let query = 'SELECT * FROM gallery';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (category && category !== 'all') {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (type && type !== 'all') {
      whereConditions.push('media_type = ?');
      params.push(type);
    }
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (search) {
      whereConditions.push('(title LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY sort_order ASC, created_at DESC';
    
    const galleryItems = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: galleryItems
    });
    
  } catch (error) {
    console.error('Get all gallery items error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get gallery item by ID
const getGalleryItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await executeQuery(
      'SELECT * FROM gallery WHERE id = ?',
      [id]
    );
    
    if (item.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }
    
    res.json({
      success: true,
      data: item[0]
    });
    
  } catch (error) {
    console.error('Get gallery item by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active gallery items for public display
const getActiveGalleryItems = async (req, res) => {
  try {
    const { category, type, limit } = req.query;
    
    let query = 'SELECT * FROM gallery WHERE status = ?';
    const params = ['active'];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (type && type !== 'all') {
      query += ' AND media_type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY sort_order ASC, created_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const galleryItems = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: galleryItems
    });
    
  } catch (error) {
    console.error('Get active gallery items error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new gallery item
const createGalleryItem = async (req, res) => {
  try {
    const {
      title,
      description,
      media_type,
      media_url,
      thumbnail_url,
      category,
      tags,
      status,
      sort_order,
      featured
    } = req.body;
    
    // Validate required fields
    if (!title || !media_type || !media_url) {
      return res.status(400).json({
        success: false,
        message: 'Title, media type, and media URL are required'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO gallery (
        title, description, media_type, media_url, thumbnail_url, category,
        tags, status, sort_order, featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, description, media_type, media_url, thumbnail_url, category,
        JSON.stringify(tags || []), status || 'active', sort_order || 0, featured || false
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Gallery item created successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create gallery item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update gallery item
const updateGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if item exists
    const existingItem = await executeQuery(
      'SELECT id FROM gallery WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = [
      'title', 'description', 'media_type', 'media_url', 'thumbnail_url',
      'category', 'tags', 'status', 'sort_order', 'featured'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'tags') {
          updateFields.push(`${field} = ?`);
          updateValues.push(JSON.stringify(updateData[field]));
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
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
      `UPDATE gallery SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: 'Gallery item updated successfully'
    });
    
  } catch (error) {
    console.error('Update gallery item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete gallery item
const deleteGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item exists
    const existingItem = await executeQuery(
      'SELECT id FROM gallery WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM gallery WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Gallery item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete gallery item error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle gallery item status
const toggleGalleryItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }
    
    // Check if item exists
    const existingItem = await executeQuery(
      'SELECT id FROM gallery WHERE id = ?',
      [id]
    );
    
    if (existingItem.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Gallery item not found'
      });
    }
    
    await executeQuery(
      'UPDATE gallery SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      success: true,
      message: 'Gallery item status updated successfully'
    });
    
  } catch (error) {
    console.error('Toggle gallery item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get gallery categories
const getGalleryCategories = async (req, res) => {
  try {
    const categories = await executeQuery(
      'SELECT DISTINCT category FROM gallery WHERE status = ? ORDER BY category',
      ['active']
    );
    
    res.json({
      success: true,
      data: categories.map(cat => cat.category)
    });
    
  } catch (error) {
    console.error('Get gallery categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get gallery statistics
const getGalleryStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) as featured
      FROM gallery
    `);
    
    const categoryStats = await executeQuery(`
      SELECT category, COUNT(*) as count
      FROM gallery
      GROUP BY category
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats[0],
        categories: categoryStats
      }
    });
    
  } catch (error) {
    console.error('Get gallery stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllGalleryItems,
  getGalleryItemById,
  getActiveGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  toggleGalleryItemStatus,
  getGalleryCategories,
  getGalleryStats
};
