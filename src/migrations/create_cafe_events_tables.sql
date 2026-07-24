-- Big Bean Café Events & Ticket Booking System
-- Migration: create_cafe_events_tables
-- Drop tables in reverse order if re-running
DROP TABLE IF EXISTS cafe_event_checkins;
DROP TABLE IF EXISTS cafe_event_bookings;
DROP TABLE IF EXISTS cafe_event_ticket_types;
DROP TABLE IF EXISTS cafe_event_dates;
DROP TABLE IF EXISTS cafe_event_outlets;
DROP TABLE IF EXISTS cafe_events;

-- 1. cafe_events
CREATE TABLE IF NOT EXISTS cafe_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    short_description TEXT NULL,
    description LONGTEXT NULL,
    event_banner VARCHAR(500) NULL,
    event_thumbnail VARCHAR(500) NULL,
    category VARCHAR(100) NULL,
    language VARCHAR(100) DEFAULT 'English, Hindi',
    duration VARCHAR(100) DEFAULT '1 Hour',
    ticket_age_rule VARCHAR(255) DEFAULT 'Ticket needed for all ages',
    entry_age_rule VARCHAR(255) DEFAULT 'Entry allowed for all ages',
    layout_type VARCHAR(100) DEFAULT 'Indoor',
    seating_type VARCHAR(150) DEFAULT 'Seated & Standing',
    kid_friendly TINYINT(1) DEFAULT 1,
    pets_allowed TINYINT(1) DEFAULT 0,
    terms_conditions LONGTEXT NULL,
    cancellation_policy LONGTEXT NULL,
    entry_policy LONGTEXT NULL,
    status ENUM('draft','active','closed','sold_out','cancelled') DEFAULT 'draft',
    is_featured TINYINT(1) DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. cafe_event_outlets
CREATE TABLE IF NOT EXISTS cafe_event_outlets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    outlet_id INT NULL,
    outlet_name VARCHAR(255) NOT NULL,
    outlet_address TEXT NULL,
    city VARCHAR(150) DEFAULT 'Bengaluru',
    map_url TEXT NULL,
    latitude VARCHAR(50) NULL,
    longitude VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_outlet_event FOREIGN KEY (event_id) REFERENCES cafe_events(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. cafe_event_dates
CREATE TABLE IF NOT EXISTS cafe_event_dates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NULL,
    door_open_time TIME NULL,
    display_time_label VARCHAR(255) NULL,
    total_seats INT DEFAULT 0,
    available_seats INT DEFAULT 0,
    status ENUM('active','sold_out','closed','cancelled') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_date_event FOREIGN KEY (event_id) REFERENCES cafe_events(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. cafe_event_ticket_types
CREATE TABLE IF NOT EXISTS cafe_event_ticket_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    ticket_name VARCHAR(150) NOT NULL,
    ticket_description TEXT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    mrp DECIMAL(10,2) NULL,
    max_per_booking INT DEFAULT 10,
    total_quantity INT DEFAULT 0,
    available_quantity INT DEFAULT 0,
    status ENUM('active','inactive','sold_out') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_type_event FOREIGN KEY (event_id) REFERENCES cafe_events(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. cafe_event_bookings
CREATE TABLE IF NOT EXISTS cafe_event_bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_number VARCHAR(100) UNIQUE NOT NULL,
    event_id INT NOT NULL,
    event_date_id INT NOT NULL,
    ticket_type_id INT NOT NULL,
    outlet_id INT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    ticket_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('online','cod','free') DEFAULT 'online',
    payment_status ENUM('pending','payment_initiated','paid','failed','refunded') DEFAULT 'pending',
    booking_status ENUM('pending','confirmed','cancelled','checked_in','no_show') DEFAULT 'pending',
    razorpay_order_id VARCHAR(255) NULL,
    razorpay_payment_id VARCHAR(255) NULL,
    razorpay_signature VARCHAR(500) NULL,
    qr_code VARCHAR(500) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_event FOREIGN KEY (event_id) REFERENCES cafe_events(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_date FOREIGN KEY (event_date_id) REFERENCES cafe_event_dates(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_booking_ticket FOREIGN KEY (ticket_type_id) REFERENCES cafe_event_ticket_types(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. cafe_event_checkins
CREATE TABLE IF NOT EXISTS cafe_event_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    checked_in_by INT NULL,
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_checkin_booking FOREIGN KEY (booking_id) REFERENCES cafe_event_bookings(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
