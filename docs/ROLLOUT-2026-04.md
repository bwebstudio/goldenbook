# Rollout — Translations v2 + Analytics v2 + Content Version

This change set introduces:

1. A **true three-language editorial system** (EN / ES / PT) with per-locale
   provenance metadata, transactional saves, and DeepL-as-suggestion-only.
2. A **global content version** with DB triggers on every editorial table,
   a public `GET /api/v1/content/version` endpoint, and mobile-side
   foreground invalidation.
3. A **unified analytics pipeline** (`analytics_events`, `user_sessions`,
   `search_queries`) with 15 tracked events, server-side enrichment,
   admin reader endpoints, and a session-close cron.

Everything is **additive**. Legacy tables and endpoints remain in place so
nothing breaks mid-deploy.

---

## Artefact inventory

### Database migrations (three new files)
- `supabase/migrations/20260418100000_translation_metadata.sql` — adds
  `source`, `is_override`, `translated_from`, `updated_by` to
  `place_translations`; legacy `translation_override` is kept in sync via a
  BEFORE-trigger; adds `places.original_locale`.
- `supabase/migrations/20260418110000_content_version.sql` — creates
  `content_version` table and attaches STATEMENT-level bump triggers to
  every editorial table.
- `supabase/migrations/20260418120000_analytics_v2.sql` — creates
  `analytics_event_name` enum, `user_sessions`, `analytics_events`,
  `search_queries` with indexes.

### Backend (Fastify)
- `api/src/modules/content/content-version.route.ts` — `GET /content/version`.
- `api/src/modules/admin/places/admin-places-unified.query.ts` — unified
  per-locale save logic.
- `api/src/modules/admin/places/admin-places.route.ts` — extended `PUT
  /admin/places/:id` to accept `{ canonical, translations }`, new
  `GET /admin/places/:id/translations/editor`, new
  `POST /admin/places/:id/translations/suggest` (DeepL non-persisting).
- `api/src/modules/analytics/events.route.ts` —
  `POST /analytics/events|sessions/start|sessions/ping|sessions/end`,
  session-close cron helper.
- `api/src/modules/admin/analytics/admin-analytics-v2.route.ts` —
  `GET /admin/analytics/users|content|features|search`.
- `api/src/modules/places/places.query.ts` — 4-tier fallback
  (`locale → family → en → original_locale → base table`).
- `api/src/app.ts` — registers new routes + 5-min session-close interval.

### Mobile (goldenbook-mobile)
- `src/analytics/track.ts` — fire-and-forget event + session helpers.
- `src/analytics/useSessionLifecycle.ts` — mount-once hook for
  `_layout.tsx`.
- `src/api/useContentVersion.ts` — foreground + per-screen polling
  invalidation.
- `src/api/client.ts` — exports `SESSION_ID`; adds `x-device-type`,
  `x-app-version`; Axios interceptor auto-injects `locale` from the
  settings store on GETs.
- `src/api/endpoints.ts` — removed every `locale = 'en'` default; callers
  either pass an explicit locale or rely on the interceptor.

### Ops
- `scripts/audit-translation-locales.ts` — CSV export of rows whose stored
  locale disagrees with the detected text language.

### Dashboard (not in this deploy)
- The three-language editor UI and new analytics widgets are specified but
  not implemented here. Ship them on the next dashboard deploy — see
  "Dashboard follow-up" below.

---

## Deployment order

The order matters: the mobile app must not be asked to poll an endpoint that
doesn't exist yet, and the dashboard must not save to an endpoint that's
reading from a schema that hasn't been migrated.

### Step 1 — Supabase migrations (production DB)

```bash
cd goldenbook-backend
supabase db push   # or: psql $DATABASE_URL -f supabase/migrations/20260418100000_translation_metadata.sql
                   #       psql $DATABASE_URL -f supabase/migrations/20260418110000_content_version.sql
                   #       psql $DATABASE_URL -f supabase/migrations/20260418120000_analytics_v2.sql
```

**Verify:**
```sql
SELECT version, updated_at FROM content_version;
-- should return one row with scope='global'.
SELECT column_name FROM information_schema.columns
 WHERE table_name='place_translations'
   AND column_name IN ('source','is_override','translated_from','updated_by');
-- should return all four.
```

**Blast radius:** zero. All migrations are additive. `translation_override`
is left untouched and bidirectionally synced with `is_override`.

**Rollback:** drop the new columns + tables. The sync trigger on
`place_translations` is a DROP TRIGGER away from reverting behavior.

### Step 2 — Backend API (Railway)

Deploy the updated Fastify service. The new routes are inert until called.

**Verify:**
```bash
curl https://goldenbook-production.up.railway.app/api/v1/content/version
# → { "global": 1, "updated_at": "..." }

curl -X POST https://…/api/v1/analytics/sessions/start \
  -H 'content-type: application/json' \
  -d '{"sessionId":"test-1","deviceType":"ios"}'
# → 204, row in user_sessions.
```

**Blast radius:** low. The extended `PUT /admin/places/:id` is
payload-detected — old flat payloads still hit the legacy code path.

**Rollback:** redeploy the previous image. No DB state needs reverting.

### Step 3 — Dashboard (Vercel / next.js)

*Not in this change set.* Ship after the three-language editor UI is
implemented. Until it is:

- Editors continue using the existing PT-only form + EN override tab.
- The new `is_override`/`source` columns stay at their defaults
  (`source='manual'`, `is_override=translation_override`), so nothing breaks.
- DeepL regeneration endpoints (`/translations/regenerate`) still work.

### Step 4 — Mobile (EAS Update, OTA)

All mobile changes in this set are pure JS:

- `track.ts`, `useSessionLifecycle.ts`, `useContentVersion.ts` — new files.
- `client.ts`, `endpoints.ts` — JS-only edits.

**Ship via:**
```bash
cd goldenbook-mobile
eas update --branch production --message "Analytics v2 + content-version sync"
```

**No store submission required.** `AppState`, `Platform`, `expo-constants`
are already present in the shipped binary.

**Wire-up (must be added in one small PR before shipping):**
In `app/_layout.tsx`, inside the top-level component:
```tsx
import { useSessionLifecycle } from '@/analytics/useSessionLifecycle';
import { useContentVersionSync } from '@/api/useContentVersion';

export default function RootLayout() {
  useSessionLifecycle();
  useContentVersionSync();
  // ... existing layout
}
```

Call-site instrumentation (`track('place_view', { placeId, source })` etc.)
is the largest remaining task — roughly 12 files (place detail, map,
search, concierge, routes, journey, saved, NOW). Ship in a follow-up OTA
after the backend has been live for 24h so events are being captured.

---

## Data cleanup (one-off)

Run **after** the translation_metadata migration:

```bash
cd goldenbook-backend
npm install --no-save franc
DATABASE_URL=… npx ts-node scripts/audit-translation-locales.ts \
  > /tmp/translation-audit-$(date +%F).csv
```

Expected output: a CSV of `(place_id, translation_id, stored_locale,
detected_locale, confidence, sample)` rows. Send `confidence IN ('medium',
'high')` rows to the editorial team for review and re-import via the
dashboard's three-language editor (or via the unified `PUT
/admin/places/:id` endpoint directly).

---

## Verification checklist

After every deploy step above, verify:

- [ ] `SELECT version FROM content_version;` returns a monotonically
      increasing value when you `UPDATE places SET name = name WHERE id = …`.
- [ ] `GET /api/v1/content/version` returns 200 with a non-zero `global`.
- [ ] `PUT /api/v1/admin/places/:id` with `{ translations: { es: { … } } }`
      writes ONLY the ES row, does not touch EN or PT.
- [ ] `POST /api/v1/admin/places/:id/translations/suggest` returns
      suggestions WITHOUT writing to `place_translations`.
- [ ] After a dashboard edit, mobile foregrounding the app invalidates the
      affected place's React Query cache within one foreground transition.
- [ ] `analytics_events` receives rows after the mobile OTA ships.
      (Watch: `SELECT event_name, COUNT(*) FROM analytics_events WHERE
      created_at > now() - interval '1 hour' GROUP BY 1;`)
- [ ] Session-close cron: `SELECT COUNT(*) FROM user_sessions WHERE
      ended_at IS NULL AND last_seen_at < now() - interval '30 minutes';`
      should return 0 within ~5 minutes of a force-quit scenario.

---

## Dashboard follow-up (separate PR)

The Next.js dashboard needs two additions that are spec'd but not
implemented in this set:

1. **Three-language editor component** — `PlaceTranslationEditor.tsx`
   with PT / EN / ES tabs, each tab offering:
   - The editable form fields (description, long_description,
     goldenbook_note, insider_tip).
   - A "Suggest" button that calls
     `POST /admin/places/:id/translations/suggest?source=pt&target=es`
     and renders the result as ghost text the editor can accept or rewrite.
   - A status pill (`Manual override` / `DeepL auto` / `Empty`).
   - All three tabs saved transactionally via the unified
     `PUT /admin/places/:id { canonical, translations }`.

2. **Analytics tabs** — add Users / Content / Features / Search tabs to
   `app/(employee)/analytics/` that consume the new
   `GET /admin/analytics/*` endpoints. Install Recharts; a line chart
   (DAU 30 days), a stacked bar (sessions by device), a histogram
   (session duration), and three ranked lists (most viewed / saved /
   booked) cover all specified widgets.

Neither the mobile app nor the backend depends on these two — ship when
editorial and product are ready to review the UX.

---

## Post-mortem guardrails

The wrong-language bug had two root causes the new system closes:

- **ES was DeepL(EN).** With the new unified save + `is_override` flag,
  ES is a first-class locale. DeepL only runs from `/translations/suggest`
  and never persists. Editors must accept a suggestion to land it, so
  every ES row on disk has a human signoff once the dashboard UI ships.

- **Silent `locale = 'en'` defaults on mobile.** Removed from every
  `endpoints.ts` callsite. The interceptor injects the settings-store
  locale on every GET; callers that forgot to pass one are no longer
  fatal.

The content-version signal closes the sync gap: editors see dashboard →
app propagation within one foreground transition rather than up to 5
minutes of React Query staleness.
