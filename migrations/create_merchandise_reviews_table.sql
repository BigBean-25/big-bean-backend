-- Create merchandise_reviews table
CREATE TABLE IF NOT EXISTS merchandise_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  merchandise_id INT NOT NULL,
  customer_id INT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_title VARCHAR(255) NULL,
  review_message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_verified_purchase TINYINT(1) DEFAULT 0,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_merchandise_reviews_merchandise_id (merchandise_id),
  INDEX idx_merchandise_reviews_status (status),
  INDEX idx_merchandise_reviews_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
