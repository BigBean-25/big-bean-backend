const { executeQuery } = require('../config/database');

// Get all testimonials
const getAllTestimonials = async (req, res) => {
  try {
    const { status, search, rating } = req.query;
    
    let query = 'SELECT * FROM testimonials';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (rating) {
      whereConditions.push('rating = ?');
      params.push(parseInt(rating));
    }
    
    if (search) {
      whereConditions.push('(customer_name LIKE ? OR company LIKE ? OR testimonial_text LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY sort_order ASC, created_at DESC';
    
    const testimonials = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: testimonials
    });
    
  } catch (error) {
    console.error('Get all testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get testimonial by ID
const getTestimonialById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const testimonial = await executeQuery(
      'SELECT * FROM testimonials WHERE id = ?',
      [id]
    );
    
    if (testimonial.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }
    
    res.json({
      success: true,
      data: testimonial[0]
    });
    
  } catch (error) {
    console.error('Get testimonial by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get active testimonials for public display
const getActiveTestimonials = async (req, res) => {
  try {
    const { limit, featured } = req.query;
    
    let query = 'SELECT * FROM testimonials WHERE status = ?';
    const params = ['active'];
    
    if (featured === 'true') {
      query += ' AND featured = ?';
      params.push(true);
    }
    
    query += ' ORDER BY sort_order ASC, created_at DESC';
    
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }
    
    const testimonials = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: testimonials
    });
    
  } catch (error) {
    console.error('Get active testimonials error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new testimonial
const createTestimonial = async (req, res) => {
  try {
    const {
      customer_name,
      company,
      role,
      testimonial_text,
      rating,
      image_url,
      featured,
      status,
      sort_order
    } = req.body;
    
    // Validate required fields
    if (!customer_name || !testimonial_text || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, testimonial text, and rating are required'
      });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO testimonials (
        customer_name, company, role, testimonial_text, rating, image_url,
        featured, status, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_name, company, role, testimonial_text, rating, image_url,
        featured || false, status || 'active', sort_order || 0
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Testimonial created successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update testimonial
const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if testimonial exists
    const existingTestimonial = await executeQuery(
      'SELECT id FROM testimonials WHERE id = ?',
      [id]
    );
    
    if (existingTestimonial.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = [
      'customer_name', 'company', 'role', 'testimonial_text', 'rating',
      'image_url', 'featured', 'status', 'sort_order'
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
      `UPDATE testimonials SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: 'Testimonial updated successfully'
    });
    
  } catch (error) {
    console.error('Update testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete testimonial
const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if testimonial exists
    const existingTestimonial = await executeQuery(
      'SELECT id FROM testimonials WHERE id = ?',
      [id]
    );
    
    if (existingTestimonial.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM testimonials WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Testimonial deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete testimonial error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle testimonial status
const toggleTestimonialStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }
    
    // Check if testimonial exists
    const existingTestimonial = await executeQuery(
      'SELECT id FROM testimonials WHERE id = ?',
      [id]
    );
    
    if (existingTestimonial.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }
    
    await executeQuery(
      'UPDATE testimonials SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      success: true,
      message: 'Testimonial status updated successfully'
    });
    
  } catch (error) {
    console.error('Toggle testimonial status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get testimonial statistics
const getTestimonialStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) as featured,
        AVG(rating) as average_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM testimonials
    `);
    
    res.json({
      success: true,
      data: stats[0]
    });
    
  } catch (error) {
    console.error('Get testimonial stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllTestimonials,
  getTestimonialById,
  getActiveTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  toggleTestimonialStatus,
  getTestimonialStats
};
