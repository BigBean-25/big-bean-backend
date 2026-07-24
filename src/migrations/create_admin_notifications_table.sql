-- Create admin_notifications table
CREATE TABLE IF NOT EXISTS admin_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NULL,
  module_name VARCHAR(100) NULL,
  record_id INT NULL,
  action_url VARCHAR(255) NULL,
  priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_by_type VARCHAR(50) NULL,
  created_by_id INT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_notifications_is_read (is_read),
  INDEX idx_admin_notifications_created_at (created_at),
  INDEX idx_admin_notifications_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
