const { executeQuery } = require('../config/database');

const ensureTable = async () => {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS contact_enquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NULL,
      subject VARCHAR(255) NOT NULL,
      category VARCHAR(100) DEFAULT 'general',
      message TEXT NOT NULL,
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
};

// Get all contact enquiries
const getAllContactEnquiries = async (req, res) => {
  try {
    await ensureTable();
    const { status, category, search } = req.query;
    
    let query = 'SELECT * FROM contact_enquiries';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (category && category !== 'all') {
      whereConditions.push('category = ?');
      params.push(category);
    }
    
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ? OR subject LIKE ?)');
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
    console.error('Get all contact enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get contact enquiry by ID
const getContactEnquiryById = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    const enquiry = await executeQuery(
      'SELECT * FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    if (enquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found'
      });
    }
    
    res.json({
      success: true,
      data: enquiry[0]
    });
    
  } catch (error) {
    console.error('Get contact enquiry by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new contact enquiry
const createContactEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const {
      name,
      email,
      phone,
      subject,
      category,
      message,
      priority
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required'
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
      `INSERT INTO contact_enquiries (
        name, email, phone, subject, category, message, priority, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, email, phone, subject, category || 'general', message,
        priority || 'medium', 'pending'
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Contact enquiry submitted successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create contact enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update contact enquiry status
const updateContactEnquiryStatus = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { status, notes } = req.body;
    
    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending/in_progress/completed) is required'
      });
    }
    
    // Check if enquiry exists
    const existingEnquiry = await executeQuery(
      'SELECT id FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    if (existingEnquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found'
      });
    }
    
    await executeQuery(
      'UPDATE contact_enquiries SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes, id]
    );
    
    res.json({
      success: true,
      message: 'Contact enquiry status updated successfully'
    });
    
  } catch (error) {
    console.error('Update contact enquiry status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete contact enquiry
const deleteContactEnquiry = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    
    // Check if enquiry exists
    const existingEnquiry = await executeQuery(
      'SELECT id FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    if (existingEnquiry.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Contact enquiry not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM contact_enquiries WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Contact enquiry deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete contact enquiry error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get contact enquiry statistics
const getContactEnquiryStats = async (req, res) => {
  try {
    await ensureTable();
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
      FROM contact_enquiries
    `);
    
    const categoryStats = await executeQuery(`
      SELECT category, COUNT(*) as count
      FROM contact_enquiries
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
    console.error('Get contact enquiry stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Bulk update contact enquiries
const bulkUpdateContactEnquiries = async (req, res) => {
  try {
    await ensureTable();
    const { ids, status, notes } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid IDs array is required'
      });
    }
    
    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (pending/in_progress/completed) is required'
      });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    await executeQuery(
      `UPDATE contact_enquiries SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [status, notes, ...ids]
    );
    
    res.json({
      success: true,
      message: `${ids.length} contact enquiries updated successfully`
    });
    
  } catch (error) {
    console.error('Bulk update contact enquiries error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllContactEnquiries,
  getContactEnquiryById,
  createContactEnquiry,
  updateContactEnquiryStatus,
  deleteContactEnquiry,
  getContactEnquiryStats,
  bulkUpdateContactEnquiries
};
