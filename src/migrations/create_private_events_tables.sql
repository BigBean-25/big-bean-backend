-- Private Events page: enquiry pipeline + page CMS (hero + gallery)
-- Safe to run repeatedly (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS private_event_enquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enquiry_reference VARCHAR(40) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NULL,
  outlet_id INT NULL,
  outlet_slug VARCHAR(120) NULL,
  outlet_name VARCHAR(255) NULL,
  occasion VARCHAR(120) NOT NULL,
  event_date DATE NULL,
  date_not_decided TINYINT(1) NOT NULL DEFAULT 0,
  preferred_time VARCHAR(50) NULL,
  duration VARCHAR(80) NULL,
  guest_count INT NULL,
  food_preferences TEXT NULL,
  requirements TEXT NULL,
  venue_visit_requested TINYINT(1) NOT NULL DEFAULT 0,
  enquiry_intent VARCHAR(40) NOT NULL DEFAULT 'general',
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(40) NOT NULL DEFAULT 'new',
  assigned_to INT NULL,
  admin_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_pe_reference (enquiry_reference),
  KEY idx_pe_status (status),
  KEY idx_pe_outlet (outlet_slug),
  KEY idx_pe_occasion (occasion),
  KEY idx_pe_created (created_at)
);

CREATE TABLE IF NOT EXISTS private_events_hero (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eyebrow VARCHAR(255) NULL,
  heading VARCHAR(255) NOT NULL,
  description TEXT NULL,
  supporting_text TEXT NULL,
  primary_cta_text VARCHAR(100) DEFAULT 'Enquire About Your Event',
  secondary_cta_text VARCHAR(100) DEFAULT 'Explore Outlet Locations',
  image VARCHAR(500) NULL,
  mobile_image VARCHAR(500) NULL,
  image_alt VARCHAR(255) NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS private_events_gallery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image VARCHAR(500) NOT NULL,
  outlet_slug VARCHAR(120) NULL,
  outlet_name VARCHAR(255) NULL,
  caption VARCHAR(255) NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
