-- Clean up duplicate business_clients rows.
-- This handles the case where the same email was linked multiple times
-- (e.g. auth user was deleted and recreated with a new UUID).

-- Step 1: Delete older duplicate rows, keeping the most recent per email+place
DELETE FROM business_clients
WHERE id NOT IN (
  SELECT DISTINCT ON (COALESCE(contact_email, user_id::text), place_id) id
  FROM business_clients
  ORDER BY COALESCE(contact_email, user_id::text), place_id, created_at DESC
);

-- Step 2: Also delete duplicates by user_id+place_id (original constraint)
DELETE FROM business_clients a
USING business_clients b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.place_id = b.place_id;

-- Step 3: Ensure the unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_clients_user_id_place_id_key'
  ) THEN
    ALTER TABLE business_clients ADD CONSTRAINT business_clients_user_id_place_id_key UNIQUE (user_id, place_id);
  END IF;
END $$;
