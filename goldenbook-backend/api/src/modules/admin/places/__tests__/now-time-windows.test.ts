// ─── NOW time-window vocabulary ────────────────────────────────────────────
//
// Regression cover for the production failure where saving any field on a
// place returned:
//
//   "Erro ao guardar. nowTimeWindows.4: Invalid enum value.
//    Expected 'morning' | 'midday' | 'afternoon' | 'evening' | 'night',
//    received 'late_evening'"
//
// Two vocabularies had drifted apart. The scoring engine emits six windows
// (`getNowTimeOfDay` in shared-scoring/context-tags.ts) and seed scripts wrote
// all six into `place_now_time_windows`, whose `time_window` column is plain
// TEXT with no CHECK. The admin write schema accepted only five of them and
// substituted a 'night' the engine never produces.
//
// The dashboard loads the stored windows, keeps them in form state and
// submits them back on every save, so the 58 places holding `late_evening` or
// `deep_night` (of 387 at the time of the audit) could not be edited at all —
// not their hours, not their category, not their text.
//
// These tests pin the vocabulary to the engine's, and pin the alias handling
// so a legacy 'night' can never reach the database again: a stored 'night'
// matched nothing at runtime and silently dropped the place out of NOW
// between 22:00 and 06:00.

import { describe, it, expect } from 'vitest'
import {
  NOW_TIME_WINDOWS,
  normalizeNowTimeWindows,
  updatePlaceSchema,
} from '../admin-places.dto'

// The values `getNowTimeOfDay()` can return, excluding the legacy 'night'
// alias. If this list and NOW_TIME_WINDOWS ever diverge again, the editorial
// windows stop matching the runtime window and NOW silently loses places.
const ENGINE_WINDOWS = [
  'morning',
  'midday',
  'afternoon',
  'evening',
  'late_evening',
  'deep_night',
] as const

describe('NOW time-window vocabulary', () => {
  it('accepts exactly the windows the scoring engine emits', () => {
    expect([...NOW_TIME_WINDOWS].sort()).toEqual([...ENGINE_WINDOWS].sort())
  })

  it('accepts the six canonical windows on update', () => {
    const parsed = updatePlaceSchema.safeParse({ nowTimeWindows: [...ENGINE_WINDOWS] })
    expect(parsed.success).toBe(true)
  })

  it('accepts a place carrying late_evening at index 4 — the reported failure', () => {
    // The exact shape that produced "nowTimeWindows.4 … received 'late_evening'".
    const parsed = updatePlaceSchema.safeParse({
      nowTimeWindows: ['morning', 'midday', 'afternoon', 'evening', 'late_evening', 'deep_night'],
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts deep_night at index 4 — the same failure on 5-window places', () => {
    const parsed = updatePlaceSchema.safeParse({
      nowTimeWindows: ['morning', 'midday', 'afternoon', 'evening', 'deep_night'],
    })
    expect(parsed.success).toBe(true)
  })

  it('still rejects a window that means nothing to the engine', () => {
    // The enum must stay closed. An unknown value would be stored verbatim
    // (the column has no CHECK) and would match no runtime window.
    const parsed = updatePlaceSchema.safeParse({ nowTimeWindows: ['brunch_time'] })
    expect(parsed.success).toBe(false)
  })
})

describe('normalizeNowTimeWindows', () => {
  it('passes canonical windows through unchanged and in order', () => {
    expect(normalizeNowTimeWindows(['evening', 'morning', 'deep_night']))
      .toEqual(['evening', 'morning', 'deep_night'])
  })

  it('maps the legacy night alias onto late_evening', () => {
    // 'night' was the dashboard's label for 22:00-06:00. The engine never
    // emits it, so a row storing it matched nothing.
    expect(normalizeNowTimeWindows(['night'])).toEqual(['late_evening'])
  })

  it('does not create a duplicate when night and late_evening both arrive', () => {
    // place_now_time_windows has UNIQUE (place_id, time_window); the insert
    // uses ON CONFLICT DO NOTHING, but collapsing here keeps the write honest.
    expect(normalizeNowTimeWindows(['late_evening', 'night'])).toEqual(['late_evening'])
    expect(normalizeNowTimeWindows(['night', 'late_evening'])).toEqual(['late_evening'])
  })

  it('drops values outside the vocabulary rather than storing them', () => {
    expect(normalizeNowTimeWindows(['morning', 'teatime', 'evening']))
      .toEqual(['morning', 'evening'])
  })

  it('de-duplicates repeated windows', () => {
    expect(normalizeNowTimeWindows(['evening', 'evening'])).toEqual(['evening'])
  })

  it('returns an empty list unchanged — "relevant at all hours"', () => {
    // No rows is meaningful: the NOW query treats a place with no editorial
    // windows as eligible for every window.
    expect(normalizeNowTimeWindows([])).toEqual([])
  })
})
