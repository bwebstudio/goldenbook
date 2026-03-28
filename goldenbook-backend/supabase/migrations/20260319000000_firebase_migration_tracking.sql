-- =========================================================
-- Firebase → Supabase migration tracking
--
-- Adds three nullable columns to the users table to create
-- a reliable, queryable audit trail for Firebase-migrated users.
--
-- legacy_firebase_uid:     Original Firebase UID. Useful for:
--                          - Cross-referencing Firestore data during cleanup
--                          - Deduplication if a user was migrated twice
--
-- migrated_from_firebase:  Set to true for all migrated accounts.
--                          Lets us filter "legacy" users in analytics/ops.
--
-- migrated_at:             Timestamp of first successful migration.
--                          Uses COALESCE in the upsert so re-running
--                          the migration endpoint never overwrites this.
--
-- REMOVABLE: Once the migration window closes, drop these columns:
--   ALTER TABLE users
--     DROP COLUMN IF EXISTS legacy_firebase_uid,
--     DROP COLUMN IF EXISTS migrated_from_firebase,
--     DROP COLUMN IF EXISTS migrated_at;
--   DROP INDEX IF EXISTS idx_users_legacy_firebase_uid;
-- =========================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS legacy_firebase_uid    TEXT,
  ADD COLUMN IF NOT EXISTS migrated_from_firebase BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS migrated_at            TIMESTAMPTZ;

-- Index on legacy_firebase_uid for deduplication checks during migration.
-- Partial index (WHERE legacy_firebase_uid IS NOT NULL) keeps it small.
CREATE INDEX IF NOT EXISTS idx_users_legacy_firebase_uid
  ON users (legacy_firebase_uid)
  WHERE legacy_firebase_uid IS NOT NULL;
