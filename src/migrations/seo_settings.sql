
CREATE TABLE IF NOT EXISTS seo_site_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO seo_site_settings (setting_key, setting_value) VALUES
('google_analytics_id',              NULL),
('google_tag_manager_id',            NULL),
('google_search_console_verification', NULL),
('facebook_domain_verification',     NULL),
('bing_verification',                NULL),
('default_og_image',                 NULL),
('business_phone',                   '+91-XXXXXXXXXX'),
('business_email',                   'hello@bigbeancafe.in'),
('business_address',                 'Bengaluru, Karnataka, India'),
('business_latitude',                '12.9716'),
('business_longitude',               '77.5946'),
('same_as_instagram',                NULL),
('same_as_facebook',                 NULL),
('same_as_linkedin',                 NULL),
('same_as_zomato',                   NULL),
('same_as_swiggy',                   NULL);

-- Add faq_schema_json if it doesn't exist (ignore error if already present)
SET @dbname = DATABASE();
SET @tablename = 'seo_pages';
SET @colname = 'faq_schema_json';
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = @colname) = 0,
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @colname, ' LONGTEXT NULL'),
  'SELECT 1'
));
PREPARE alter_stmt FROM @preparedStatement;
EXECUTE alter_stmt;
DEALLOCATE PREPARE alter_stmt;
