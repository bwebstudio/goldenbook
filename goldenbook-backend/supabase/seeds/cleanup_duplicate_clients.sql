-- Clean up duplicate business_clients rows.
-- Keeps the most recent row for each (user_id, place_id) pair.

DELETE FROM business_clients a
USING business_clients b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.place_id = b.place_id;

-- Verify the unique constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_clients_user_id_place_id_key'
  ) THEN
    ALTER TABLE business_clients ADD CONSTRAINT business_clients_user_id_place_id_key UNIQUE (user_id, place_id);
    RAISE NOTICE 'Added unique constraint on business_clients(user_id, place_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

-- Show result
SELECT bc.contact_name, bc.contact_email, p.name AS place_name, bc.is_active
FROM business_clients bc
JOIN places p ON p.id = bc.place_id
ORDER BY bc.contact_name;
