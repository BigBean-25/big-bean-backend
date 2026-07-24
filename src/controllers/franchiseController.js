const { executeQuery } = require('../config/database');

// Get all franchise enquiries
const getAllFranchiseEnquiries = async (req, res) => {
  try {
    const { status, search, city } = req.query;
    
    let query = 'SELECT * FROM franchise_enquiries';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (city) {
      whereConditions.push('city LIKE ?');
      params.push(`%${city}%`);
    }
    
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ? OR company_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const enquiries = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: enquiries
    });
    
  } catch (error) {
    console.error('Get all franchise enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get franchise enquiry by ID
const getFranchiseEnquiryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const enquiry = await executeQuery(
      'SELECT * FROM franchise_enquiries WHERE id = ?',
      [id]
    );
    
    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Franchise enquiry not found'
      });
    }
    
    res.json({
      success: true,
      data: enquiry[0]
    });
    
  } catch (error) {
    console.error('Get franchise enquiry by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new franchise enquiry
const createFranchiseEnquiry = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company_name,
      city,
      state,
      investment_range,
      experience,
      timeline,
      message,
      preferred_location
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone || !city) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, phone, and city are required'
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
      `INSERT INTO franchise_enquiries (
        name, email, phone, company_name, city, state, investment_range,
        experience, timeline, message, preferred_location, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, email, phone, company_name, city, state, investment_range,
        experience, timeline, message, preferred_location, 'pending'
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Franchise enquiry submitted successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create franchise enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update franchise enquiry status
const updateFranchiseEnquiryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, next_follow_up } = req.body;
    
    if (!status || !['pending', 'in_progress', 'completed', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending/in_progress/completed/rejected) is required'
      });
    }
    
    // Check if enquiry exists
    const existingEnquiry = await executeQuery(
      'SELECT id FROM franchise_enquiries WHERE id = ?',
      [id]
    );
    
    if (existingEnquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Franchise enquiry not found'
      });
    }
    
    await executeQuery(
      'UPDATE franchise_enquiries SET status = ?, notes = ?, next_follow_up = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, next_follow_up, id]
    );
    
    res.json({
      success: true,
      message: 'Franchise enquiry status updated successfully'
    });
    
  } catch (error) {
    console.error('Update franchise enquiry status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete franchise enquiry
const deleteFranchiseEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if enquiry exists
    const existingEnquiry = await executeQuery(
      'SELECT id FROM franchise_enquiries WHERE id = ?',
      [id]
    );
    
    if (existingEnquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Franchise enquiry not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM franchise_enquiries WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Franchise enquiry deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete franchise enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get franchise enquiry statistics
const getFranchiseEnquiryStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
      FROM franchise_enquiries
    `);
    
    const cityStats = await executeQuery(`
      SELECT city, COUNT(*) as count
      FROM franchise_enquiries
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const investmentStats = await executeQuery(`
      SELECT investment_range, COUNT(*) as count
      FROM franchise_enquiries
      WHERE investment_range IS NOT NULL
      GROUP BY investment_range
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats[0],
        cities: cityStats,
        investments: investmentStats
      }
    });
    
  } catch (error) {
    console.error('Get franchise enquiry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get franchise enquiry follow-ups
const getFranchiseFollowUps = async (req, res) => {
  try {
    const followUps = await executeQuery(`
      SELECT * FROM franchise_enquiries 
      WHERE next_follow_up IS NOT NULL 
      AND next_follow_up <= DATE_ADD(NOW(), INTERVAL 7 DAY)
      AND status != 'completed'
      ORDER BY next_follow_up ASC
    `);
    
    res.json({
      success: true,
      data: followUps
    });
    
  } catch (error) {
    console.error('Get franchise follow-ups error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllFranchiseEnquiries,
  getFranchiseEnquiryById,
  createFranchiseEnquiry,
  updateFranchiseEnquiryStatus,
  deleteFranchiseEnquiry,
  getFranchiseEnquiryStats,
  getFranchiseFollowUps
};
