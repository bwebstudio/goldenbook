-- ============================================================================
-- TEST USERS — ROLE ASSIGNMENTS
-- ============================================================================
--
-- STEP 1 (manual — Supabase Dashboard):
--   Go to Authentication → Users → Add user (with Auto Confirm ON)
--   Create these 3 users:
--     superadmin@goldenbook.pt / Test1234!
--     editor@goldenbook.pt     / Test1234!
--     business@goldenbook.pt   / Test1234!
--
--   DO NOT create auth users via direct SQL — it breaks Supabase internals.
--
-- STEP 2 (run this SQL in Supabase SQL Editor):
--   This script assigns roles and links the business client to a place.
-- ============================================================================

-- ── Admin roles ─────────────────────────────────────────────────────────────

INSERT INTO admin_users (email, full_name, role)
VALUES ('superadmin@goldenbook.pt', 'Admin Goldenbook', 'super_admin')
ON CONFLICT (email) DO UPDATE SET role = 'super_admin', full_name = 'Admin Goldenbook';

INSERT INTO admin_users (email, full_name, role)
VALUES ('editor@goldenbook.pt', 'Maria Editor', 'editor')
ON CONFLICT (email) DO UPDATE SET role = 'editor', full_name = 'Maria Editor';

-- ── Business client link ────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id UUID;
  v_place_id UUID;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users WHERE email = 'business@goldenbook.pt' LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE '⚠ business@goldenbook.pt not found in auth.users — create it in the Supabase Dashboard first';
    RETURN;
  END IF;

  INSERT INTO users (id, onboarding_completed, created_at, updated_at)
  VALUES (v_user_id, false, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_place_id
  FROM places WHERE status = 'published' ORDER BY created_at ASC LIMIT 1;

  IF v_place_id IS NULL THEN
    RAISE NOTICE '⚠ No published place found — create at least one place first';
    RETURN;
  END IF;

  INSERT INTO business_clients (user_id, place_id, contact_name, contact_email, is_active)
  VALUES (v_user_id, v_place_id, 'Business Owner', 'business@goldenbook.pt', true)
  ON CONFLICT (user_id, place_id) DO UPDATE SET is_active = true, contact_name = 'Business Owner';

  RAISE NOTICE '✓ Business client linked: user=%, place=%', v_user_id, v_place_id;
END $$;

-- ── Verify ──────────────────────────────────────────────────────────────────

SELECT 'AUTH USERS' AS section, email, id FROM auth.users
WHERE email IN ('superadmin@goldenbook.pt', 'editor@goldenbook.pt', 'business@goldenbook.pt')
ORDER BY email;

SELECT 'ADMIN ROLES' AS section, email, full_name, role FROM admin_users
WHERE email IN ('superadmin@goldenbook.pt', 'editor@goldenbook.pt')
ORDER BY email;

SELECT 'BUSINESS CLIENTS' AS section, bc.contact_email, p.name AS place_name, bc.is_active
FROM business_clients bc JOIN places p ON p.id = bc.place_id
WHERE bc.contact_email = 'business@goldenbook.pt';
