-- Migration: create_about_founders
-- Safe to run multiple times (CREATE TABLE IF NOT EXISTS)
-- Matches schema expected by aboutFounderController.js
-- Created: 2026-08-10

CREATE TABLE IF NOT EXISTS about_founders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  image VARCHAR(500) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  instagram_url VARCHAR(500) NULL,
  linkedin_url VARCHAR(500) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
