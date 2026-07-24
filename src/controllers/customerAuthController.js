const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'bigbean_dev_secret_2024';
const JWT_EXPIRES = '7d';

const ensureTables = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(180) NULL,
      phone VARCHAR(30) NULL,
      password_hash VARCHAR(255) NOT NULL,
      profile_image VARCHAR(500) NULL,
      date_of_birth DATE NULL,
      gender VARCHAR(30) NULL,
      status ENUM('active','inactive','blocked') DEFAULT 'active',
      email_verified TINYINT(1) DEFAULT 0,
      phone_verified TINYINT(1) DEFAULT 0,
      last_login_at DATETIME NULL,
      login_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_email (email),
      UNIQUE KEY uq_phone (phone)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customer_login_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NULL,
      identifier VARCHAR(180) NULL,
      login_status ENUM('success','failed') DEFAULT 'success',
      ip_address VARCHAR(80) NULL,
      user_agent TEXT NULL,
      message VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      label VARCHAR(80) DEFAULT 'Home',
      full_name VARCHAR(150) NULL,
      phone VARCHAR(30) NULL,
      address_line_1 TEXT NOT NULL,
      address_line_2 TEXT NULL,
      landmark VARCHAR(180) NULL,
      city VARCHAR(100) DEFAULT 'Bengaluru',
      state VARCHAR(100) DEFAULT 'Karnataka',
      pincode VARCHAR(20) NULL,
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customer_wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      merchandise_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cw (customer_id, merchandise_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS customer_support_tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      subject VARCHAR(180) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('open','in_progress','closed') DEFAULT 'open',
      admin_reply TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);
};

const safe = (obj) => {
  const { password_hash, ...rest } = obj;
  return rest;
};

exports.register = async (req, res) => {
  try {
    await ensureTables();
    const { full_name, email, phone, password } = req.body;
    if (!full_name || !password) return res.status(400).json({ success: false, message: 'full_name and password are required' });
    if (!email && !phone) return res.status(400).json({ success: false, message: 'Email or phone is required' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

    if (email) {
      const [ex] = await pool.execute('SELECT id FROM customers WHERE email = ?', [email.toLowerCase()]);
      if (ex.length) return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (phone) {
      const [ex] = await pool.execute('SELECT id FROM customers WHERE phone = ?', [phone]);
      if (ex.length) return res.status(400).json({ success: false, message: 'Phone already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO customers (full_name, email, phone, password_hash) VALUES (?,?,?,?)',
      [full_name, email ? email.toLowerCase() : null, phone || null, password_hash]
    );

    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    const token = jwt.sign({ id: rows[0].id, type: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return res.status(201).json({ success: true, message: 'Registered successfully!', token, data: safe(rows[0]) });
  } catch (err) {
    console.error('Customer register error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    await ensureTables();
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ success: false, message: 'Identifier and password are required' });

    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';

    const [rows] = await pool.execute(
      'SELECT * FROM customers WHERE email = ? OR phone = ?',
      [identifier.toLowerCase(), identifier]
    );

    if (!rows.length) {
      await pool.execute(
        'INSERT INTO customer_login_logs (identifier, login_status, ip_address, user_agent, message) VALUES (?,?,?,?,?)',
        [identifier, 'failed', ip, ua, 'Account not found']
      );
      return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
    }

    const customer = rows[0];

    if (customer.status !== 'active') {
      await pool.execute(
        'INSERT INTO customer_login_logs (customer_id, identifier, login_status, ip_address, user_agent, message) VALUES (?,?,?,?,?,?)',
        [customer.id, identifier, 'failed', ip, ua, 'Account not active']
      );
      return res.status(403).json({ success: false, message: 'Your account is not active. Please contact Big Bean Café support.' });
    }

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) {
      await pool.execute(
        'INSERT INTO customer_login_logs (customer_id, identifier, login_status, ip_address, user_agent, message) VALUES (?,?,?,?,?,?)',
        [customer.id, identifier, 'failed', ip, ua, 'Wrong password']
      );
      return res.status(401).json({ success: false, message: 'Invalid email/phone or password' });
    }

    await pool.execute(
      'UPDATE customers SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = ?',
      [customer.id]
    );
    await pool.execute(
      'INSERT INTO customer_login_logs (customer_id, identifier, login_status, ip_address, user_agent, message) VALUES (?,?,?,?,?,?)',
      [customer.id, identifier, 'success', ip, ua, 'Login successful']
    );

    const [updated] = await pool.execute('SELECT * FROM customers WHERE id = ?', [customer.id]);
    const token = jwt.sign({ id: customer.id, type: 'customer' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    return res.json({ success: true, message: 'Login successful', token, data: safe(updated[0]) });
  } catch (err) {
    console.error('Customer login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Customer not found' });
    return res.json({ success: true, data: safe(rows[0]) });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone, date_of_birth, gender } = req.body;
    await pool.execute(
      'UPDATE customers SET full_name=COALESCE(?,full_name), email=COALESCE(?,email), phone=COALESCE(?,phone), date_of_birth=COALESCE(?,date_of_birth), gender=COALESCE(?,gender), updated_at=NOW() WHERE id=?',
      [full_name || null, email ? email.toLowerCase() : null, phone || null, date_of_birth || null, gender || null, req.customer.id]
    );
    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    return res.json({ success: true, message: 'Profile updated', data: safe(rows[0]) });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ success: false, message: 'Update failed' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

    const [rows] = await pool.execute('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
    const valid = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await pool.execute('UPDATE customers SET password_hash=? WHERE id=?', [hash, req.customer.id]);
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
