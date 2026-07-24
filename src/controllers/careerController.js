const { executeQuery } = require('../config/database');

// Get all career applications
const getAllCareerApplications = async (req, res) => {
  try {
    const { status, position, search } = req.query;
    
    let query = 'SELECT * FROM career_applications';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (position) {
      whereConditions.push('job_title LIKE ?');
      params.push(`%${position}%`);
    }
    
    if (search) {
      whereConditions.push('(full_name LIKE ? OR email LIKE ? OR job_title LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const applications = await executeQuery(query, params);
    
    res.json({
      success: true,
      data: applications
    });
    
  } catch (error) {
    console.error('Get all career applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get career application by ID
const getCareerApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const application = await executeQuery(
      'SELECT * FROM career_applications WHERE id = ?',
      [id]
    );
    
    if (application.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    
    res.json({
      success: true,
      data: application[0]
    });
    
  } catch (error) {
    console.error('Get career application by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new career application
const createCareerApplication = async (req, res) => {
  try {
    const {
      name, full_name,
      email,
      phone,
      position, job_title,
      experience,
      education,
      skills,
      expected_salary,
      notice_period,
      cover_letter,
      resume_path
    } = req.body;
    
    const applicantName = full_name || name;
    const appliedPosition = job_title || position;

    // Validate required fields
    if (!applicantName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required'
      });
    }
    
    const result = await executeQuery(
      `INSERT INTO career_applications (
        full_name, email, phone, job_title, experience, education, skills,
        expected_salary, notice_period, cover_letter, resume_file, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      [
        applicantName, email, phone, appliedPosition || null, experience || null,
        education || null, skills || null,
        expected_salary || null, notice_period || null, cover_letter || null, resume_path || null
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Career application submitted successfully',
      data: {
        id: result.insertId,
        ...req.body
      }
    });
    
  } catch (error) {
    console.error('Create career application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update career application status
const updateCareerApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, next_step } = req.body;
    
    const validStatuses = ['new', 'reviewed', 'shortlisted', 'rejected', 'hired', 'pending', 'in_progress', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    // Check if application exists
    const existingApplication = await executeQuery(
      'SELECT id FROM career_applications WHERE id = ?',
      [id]
    );
    
    if (existingApplication.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    
    await executeQuery(
      'UPDATE career_applications SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, notes || null, id]
    );
    
    res.json({
      success: true,
      message: 'Career application status updated successfully'
    });
    
  } catch (error) {
    console.error('Update career application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete career application
const deleteCareerApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if application exists
    const existingApplication = await executeQuery(
      'SELECT id FROM career_applications WHERE id = ?',
      [id]
    );
    
    if (existingApplication.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    
    await executeQuery(
      'DELETE FROM career_applications WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Career application deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete career application error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get career application statistics
const getCareerApplicationStats = async (req, res) => {
  try {
    const stats = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('pending','new') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status IN ('in_progress','reviewed','shortlisted') THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status IN ('completed','hired') THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
      FROM career_applications
    `);
    
    const positionStats = await executeQuery(`
      SELECT job_title as position, COUNT(*) as count
      FROM career_applications
      WHERE job_title IS NOT NULL
      GROUP BY job_title
      ORDER BY count DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        overview: stats[0],
        positions: positionStats
      }
    });
    
  } catch (error) {
    console.error('Get career application stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllCareerApplications,
  getCareerApplicationById,
  createCareerApplication,
  updateCareerApplicationStatus,
  deleteCareerApplication,
  getCareerApplicationStats
};
