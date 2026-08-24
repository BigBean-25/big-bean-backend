-- Migration: Add per-outlet SEO fields to outlets table
-- Run once against target DB. MySQL does not support ADD COLUMN IF NOT EXISTS
-- in all versions, so verify the columns are absent before re-running:
--   SHOW COLUMNS FROM outlets LIKE 'seo_%';
-- date: 2026-08-24

ALTER TABLE outlets
  ADD COLUMN seo_title VARCHAR(255) NULL
    COMMENT 'Per-outlet SEO meta title (editable from Admin -> Outlets)' AFTER store_branch_id,
  ADD COLUMN seo_description TEXT NULL
    COMMENT 'Per-outlet meta description' AFTER seo_title,
  ADD COLUMN seo_h1 VARCHAR(255) NULL
    COMMENT 'Per-outlet visible H1 heading (falls back to outlet name)' AFTER seo_description,
  ADD COLUMN og_title VARCHAR(255) NULL
    COMMENT 'Per-outlet Open Graph title (falls back to seo_title)' AFTER seo_h1,
  ADD COLUMN og_description TEXT NULL
    COMMENT 'Per-outlet Open Graph description (falls back to seo_description)' AFTER og_title;
