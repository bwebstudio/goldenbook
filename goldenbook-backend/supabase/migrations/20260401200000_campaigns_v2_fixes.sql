-- ============================================================================
-- CAMPAIGNS V2 FIXES — Explicit all_day, improved constraints
-- ============================================================================

-- Add 'all_day' to time_bucket enum
ALTER TYPE time_bucket ADD VALUE IF NOT EXISTS 'all_day';

-- Backfill NULL time_buckets to 'all_day'
UPDATE campaign_inventory SET time_bucket = 'all_day' WHERE time_bucket IS NULL;

-- Make time_bucket NOT NULL with default
ALTER TABLE campaign_inventory ALTER COLUMN time_bucket SET NOT NULL;
ALTER TABLE campaign_inventory ALTER COLUMN time_bucket SET DEFAULT 'all_day';

-- The UNIQUE constraint already covers (campaign_id, position, date, time_bucket)
-- Since time_bucket is now NOT NULL, no COALESCE needed.
