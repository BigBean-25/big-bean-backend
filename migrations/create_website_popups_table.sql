-- Migration: create_website_popups_table
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- Created: 2026-08-05

CREATE TABLE IF NOT EXISTS website_popups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  popup_type ENUM('merchandise','event','offer','general') NOT NULL DEFAULT 'general',
  short_description TEXT NULL,
  desktop_image VARCHAR(500) NOT NULL,
  mobile_image VARCHAR(500) NULL,
  link_enabled TINYINT(1) NOT NULL DEFAULT 0,
  button_text VARCHAR(100) NULL,
  button_url VARCHAR(1000) NULL,
  open_in_new_tab TINYINT(1) NOT NULL DEFAULT 0,
  image_clickable TINYINT(1) NOT NULL DEFAULT 0,
  display_delay_ms INT UNSIGNED NOT NULL DEFAULT 0,
  display_frequency ENUM(
    'every_visit',
    'once_per_session',
    'once_per_day',
    'show_once'
  ) NOT NULL DEFAULT 'once_per_session',
  target_pages JSON NULL,
  target_devices ENUM('all','desktop','mobile') NOT NULL DEFAULT 'all',
  priority INT NOT NULL DEFAULT 0,
  start_at DATETIME NULL,
  end_at DATETIME NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_popup_status (status),
  INDEX idx_popup_schedule (start_at, end_at),
  INDEX idx_popup_priority (priority)
);
