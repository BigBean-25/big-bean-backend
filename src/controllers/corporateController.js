const { executeQuery } = require('../config/database');

// Get all corporate orders
const getAllCorporateOrders = async (req, res) => {
  try {
    const { status, search, order_type } = req.query;
    
    let query = 'SELECT * FROM corporate_orders';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (order_type && order_type !== 'all') {
      whereConditions.push('order_type = ?');
      params.push(order_type);
    }
    
    if (search) {
      whereConditions.push('(company_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const orders = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: orders
    });
    
  } catch (error) {
    console.error('Get all corporate orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get corporate order by ID
const getCorporateOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await executeQuery(
      'SELECT * FROM corporate_orders WHERE id = ?',
      [id]
    );
    
    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Corporate order not found'
      });
    }
    
    res.json({
      success: true,
      data: order[0]
    });
    
  } catch (error) {
    console.error('Get corporate order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new corporate order
const createCorporateOrder = async (req, res) => {
  try {
    const {
      company_name,
      contact_person,
      email,
      phone,
      order_type,
      quantity,
      delivery_date,
      delivery_address,
      budget_range,
      requirements
    } = req.body;
    
    // Validate required fields
    if (!company_name || !contact_person || !email || !phone || !order_type) {
      return res.status(400).json({
        success: false,
        message: 'Company name, contact person, email, phone, and order type are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO corporate_orders (
        company_name, contact_person, email, phone, order_type, quantity,
        delivery_date, delivery_address, budget_range, requirements, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_name, contact_person, email, phone, order_type, quantity,
        delivery_date, delivery_address, budget_range, requirements, 'pending'
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Corporate order submitted successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create corporate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update corporate order status
const updateCorporateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, quote_amount } = req.body;
    
    if (!status || !['pending', 'in_progress', 'quoted', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    // Check if order exists
    const existingOrder = await executeQuery(
      'SELECT id FROM corporate_orders WHERE id = ?',
      [id]
    );
    
    if (existingOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Corporate order not found'
      });
    }
    
    await executeQuery(
      'UPDATE corporate_orders SET status = ?, notes = ?, quote_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, quote_amount, id]
    );
    
    res.json({
      success: true,
      message: 'Corporate order status updated successfully'
    });
    
  } catch (error) {
    console.error('Update corporate order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete corporate order
const deleteCorporateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if order exists
    const existingOrder = await executeQuery(
      'SELECT id FROM corporate_orders WHERE id = ?',
      [id]
    );
    
    if (existingOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Corporate order not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM corporate_orders WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Corporate order deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete corporate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get corporate order statistics
const getCorporateOrderStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END) as quoted,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
      FROM corporate_orders
    `);
    
    const typeStats = await executeQuery(`
      SELECT order_type, COUNT(*) as count
      FROM corporate_orders
      GROUP BY order_type
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats[0],
        types: typeStats
      }
    });
    
  } catch (error) {
    console.error('Get corporate order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllCorporateOrders,
  getCorporateOrderById,
  createCorporateOrder,
  updateCorporateOrderStatus,
  deleteCorporateOrder,
  getCorporateOrderStats
};
