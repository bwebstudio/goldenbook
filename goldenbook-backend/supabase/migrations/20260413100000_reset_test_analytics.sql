-- Reset test/demo analytics data so the dashboard starts clean.
-- These tables contained only test purchases from development.
-- Uses IF EXISTS checks because not all tables may have been created.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchases',
    'campaign_inventory',
    'booking_click_events',
    'booking_impression_events',
    'place_analytics_events',
    'place_view_events',
    'place_website_click_events'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
    END IF;
  END LOOP;
END $$;
