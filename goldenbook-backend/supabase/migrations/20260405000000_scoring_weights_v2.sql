-- ─── Scoring Weights V2: Migrate to 5-key structure ─────────────────────────
--
-- Old keys: proximity, moment, time, weather, base_quality, user, commercial, now_tags
-- New keys: commercial, context, editorial, quality, proximity
--
-- The application code handles both formats during transition (see now.weights.ts migrateWeights).
-- This migration updates existing rows to the new format for consistency.

-- Update scoring_weights rows that still have old-format keys
UPDATE scoring_weights
SET weights = jsonb_build_object(
  'commercial', ROUND((COALESCE((weights->>'commercial')::numeric, 0.05) + COALESCE((weights->>'now_tags')::numeric, 0.20))::numeric, 3),
  'context',    ROUND((COALESCE((weights->>'moment')::numeric, 0.15) + COALESCE((weights->>'time')::numeric, 0.10) + COALESCE((weights->>'weather')::numeric, 0.08))::numeric, 3),
  'editorial',  0.15,
  'quality',    ROUND(COALESCE((weights->>'base_quality')::numeric, 0.22)::numeric, 3),
  'proximity',  ROUND(COALESCE((weights->>'proximity')::numeric, 0.10)::numeric, 3)
),
updated_at = now()
WHERE weights ? 'moment' OR weights ? 'base_quality' OR weights ? 'now_tags';

-- Update scoring_weight_adjustments delta keys for consistency
-- (old deltas with moment/time/weather keys will be ignored by new code safely)
