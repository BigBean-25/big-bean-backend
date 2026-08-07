-- Migration: Add store_branch_id to outlets table
-- Run once against target DB. Safe to re-run: ADD COLUMN IF NOT EXISTS not supported
-- in all MySQL versions, so check manually before re-running.
-- date: 2026-08-07

ALTER TABLE outlets
  ADD COLUMN store_branch_id INT NULL
  COMMENT 'Store/App branch ID used for outlet-specific menu pricing and availability';

-- Backfill: map existing outlet slugs to confirmed Store branch IDs
-- Uses slug (stable unique key), not outlet name or website ID.

UPDATE outlets SET store_branch_id = 14 WHERE slug = 'electronic-city';
UPDATE outlets SET store_branch_id = 11 WHERE slug = 'hsr-layout';
UPDATE outlets SET store_branch_id = 13 WHERE slug = 'indiranagar';
UPDATE outlets SET store_branch_id = 12 WHERE slug = 'jayanagar';
UPDATE outlets SET store_branch_id = 18 WHERE slug = 'kammanahalli';
UPDATE outlets SET store_branch_id = 15 WHERE slug = 'rajarajeshwari-nagar';
UPDATE outlets SET store_branch_id =  1 WHERE slug = 'koramangala';
