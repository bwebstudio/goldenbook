-- Close the place-images bucket to writes from the public anon key.
--
-- These three policies were named "Allow authenticated ..." but granted to the
-- `public` role, so anyone holding the anon key (it ships inside the mobile
-- app and the web bundles) could upload, overwrite or delete any place photo.
-- All writes now go through the API with the service-role key, which bypasses
-- RLS: the employee editor (POST /admin/places/:id/images/upload) and the
-- business portal (POST /business/images).
--
-- APPLY ONLY AFTER deploying the API and dashboard that upload through the
-- API. Applied earlier, the old dashboard's browser upload would start failing.
--
-- Public read stays: the app and the web load photos from the public URL.

drop policy if exists "Allow authenticated upload to place-images" on storage.objects;
drop policy if exists "Allow authenticated update on place-images" on storage.objects;
drop policy if exists "Allow authenticated delete on place-images" on storage.objects;
