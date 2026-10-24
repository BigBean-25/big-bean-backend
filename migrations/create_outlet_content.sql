-- Per-outlet marketing content: facilities + event space details.
-- facilities stores a JSON array of facility keys (see outletContentController.FACILITY_KEYS).
-- event_space_text is optional free text shown only when the 'event_space'
-- facility key is enabled for the outlet.
CREATE TABLE IF NOT EXISTS outlet_content (
  outlet_id INT PRIMARY KEY,
  facilities TEXT NULL,
  event_space_text TEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
