-- Admin RBAC Tables Migration
-- This creates the role-based access control system for admin users

-- Create admin_roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  role_key VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NULL,
  is_system TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT NULL,
  status ENUM('active','inactive','blocked') DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Create admin_permissions table
CREATE TABLE IF NOT EXISTS admin_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module_key VARCHAR(120) NOT NULL,
  module_name VARCHAR(150) NOT NULL,
  permission_key VARCHAR(150) NOT NULL UNIQUE,
  permission_name VARCHAR(150) NOT NULL,
  permission_group VARCHAR(100) NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_role_permissions table
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT 0,
  can_create TINYINT(1) DEFAULT 0,
  can_edit TINYINT(1) DEFAULT 0,
  can_delete TINYINT(1) DEFAULT 0,
  can_export TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_role_permission (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
);

-- Create admin_user_permissions table (for user-specific overrides)
CREATE TABLE IF NOT EXISTS admin_user_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT NULL,
  can_create TINYINT(1) DEFAULT NULL,
  can_edit TINYINT(1) DEFAULT NULL,
  can_delete TINYINT(1) DEFAULT NULL,
  can_export TINYINT(1) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_permission (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE
);

-- Create admin_activity_logs table (optional but recommended)
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  action VARCHAR(150) NOT NULL,
  module_key VARCHAR(120) NULL,
  record_id INT NULL,
  details JSON NULL,
  ip_address VARCHAR(100) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
