const { executeQuery } = require('../config/database');

// Get all admin users
const getAllAdminUsers = async (req, res) => {
  try {
    const { status, role, search } = req.query;
    
    let query = 'SELECT id, name, email, role, status, last_login, created_at FROM admin_users';
    const params = [];
    
    // Build WHERE clause for filters
    const whereConditions = [];
    
    if (status && status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (role && role !== 'all') {
      whereConditions.push('role = ?');
      params.push(role);
    }
    
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const users = await executeQuery(query, params);
    
    // Remove password from response
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json({
      success: true,
      data: usersWithoutPassword
    });
    
  } catch (error) {
    console.error('Get all admin users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get admin user by ID
const getAdminUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await executeQuery(
      'SELECT id, name, email, role, status, last_login, created_at FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    res.json({
      success: true,
      data: user[0]
    });
    
  } catch (error) {
    console.error('Get admin user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create new admin user
const createAdminUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      status
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required'
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
    
    // Check if email already exists
    const existingUser = await executeQuery(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
    
    // Hash password (in production, use bcrypt)
    const hashedPassword = password; // TODO: Implement proper password hashing
    
    const result = await executeQuery(
      'INSERT INTO admin_users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, status || 'active']
    );
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: result.insertId,
        name,
        email,
        role,
        status: status || 'active'
      }
    });
    
  } catch (error) {
    console.error('Create admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update admin user
const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    
    const allowedFields = ['name', 'email', 'role', 'status'];
    
    // Check if email is being updated and if it already exists
    if (updateData.email) {
      const emailExists = await executeQuery(
        'SELECT id FROM admin_users WHERE email = ? AND id != ?',
        [updateData.email, id]
      );
      
      if (emailExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }
    
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
      `UPDATE admin_users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({
      success: true,
      message: 'Admin user updated successfully'
    });
    
  } catch (error) {
    console.error('Update admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete admin user
const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT id FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Prevent deletion of the last super admin
    const superAdminCount = await executeQuery(
      'SELECT COUNT(*) as count FROM admin_users WHERE role = ? AND status = ?',
      ['super_admin', 'active']
    );
    
    if (superAdminCount[0].count <= 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the last super admin user'
      });
    }
    
    await executeQuery(
      'DELETE FROM admin_users WHERE id = ?',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Toggle admin user status
const toggleAdminUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (active/inactive) is required'
      });
    }
    
    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT id, role FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Prevent deactivation of the last super admin
    if (status === 'inactive' && existingUser[0].role === 'super_admin') {
      const superAdminCount = await executeQuery(
        'SELECT COUNT(*) as count FROM admin_users WHERE role = ? AND status = ?',
        ['super_admin', 'active']
      );
      
      if (superAdminCount[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last super admin user'
        });
      }
    }
    
    await executeQuery(
      'UPDATE admin_users SET status = ? WHERE id = ?',
      [status, id]
    );
    
    res.json({
      success: true,
      message: 'Admin user status updated successfully'
    });
    
  } catch (error) {
    console.error('Toggle admin user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update admin user password
const updateAdminUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }
    
    // Check if user exists
    const existingUser = await executeQuery(
      'SELECT password FROM admin_users WHERE id = ?',
      [id]
    );
    
    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found'
      });
    }
    
    // Verify current password (in production, use bcrypt compare)
    if (existingUser[0].password !== current_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Hash new password (in production, use bcrypt)
    const hashedNewPassword = new_password; // TODO: Implement proper password hashing
    
    await executeQuery(
      'UPDATE admin_users SET password = ? WHERE id = ?',
      [hashedNewPassword, id]
    );
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('Update admin user password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  toggleAdminUserStatus,
  updateAdminUserPassword
};
