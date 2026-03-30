// Shared validation and helpers for booking tracking (clicks + impressions).

import { z } from 'zod'
import { db } from '../../db/postgres'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const PROVIDERS = ['booking', 'thefork', 'viator', 'getyourguide', 'website', 'contact'] as const
export const BOOKING_MODES = [
  'affiliate_booking', 'affiliate_thefork', 'affiliate_viator',
  'affiliate_getyourguide', 'direct_website', 'contact_only',
] as const
export const DEVICE_TYPES = ['ios', 'android', 'web'] as const

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const trackingEventSchema = z.object({
  placeId:     z.string().uuid(),
  provider:    z.enum(PROVIDERS),
  bookingMode: z.enum(BOOKING_MODES),
  targetUrl:   z.string().max(2000).nullable().optional(),
  locale:      z.string().max(10).nullable().optional(),
  city:        z.string().max(100).nullable().optional(),
  sessionId:   z.string().max(200).nullable().optional(),
})

export type TrackingEventInput = z.infer<typeof trackingEventSchema>

// ─── Normalize ───────────────────────────────────────────────────────────────

export function normalizeCity(city: string | undefined | null): string | null {
  if (!city) return null
  return city.trim().toLowerCase().replace(/\s+/g, '-')
}

export function normalizeLocale(locale: string | undefined | null): string | null {
  if (!locale) return null
  const trimmed = locale.trim().toLowerCase()
  // Accept: en, pt, pt-pt, pt-PT → normalize to lowercase
  if (/^[a-z]{2}(-[a-z]{2})?$/i.test(trimmed)) return trimmed
  return trimmed.slice(0, 5)
}

// ─── Place existence check ───────────────────────────────────────────────────
// Uses a simple in-memory cache with TTL to avoid hitting DB on every event.

const placeExistsCache = new Map<string, number>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function placeExists(placeId: string): Promise<boolean> {
  const cached = placeExistsCache.get(placeId)
  if (cached && Date.now() - cached < CACHE_TTL_MS) return true

  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM places WHERE id = $1 LIMIT 1`,
    [placeId],
  )
  if (rows[0]) {
    placeExistsCache.set(placeId, Date.now())
    return true
  }
  return false
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Simple in-memory sliding window per IP. Not distributed — suitable for single instance.

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 60           // max 60 events per minute per IP

export function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS

  let timestamps = rateLimitMap.get(ip)
  if (!timestamps) {
    timestamps = []
    rateLimitMap.set(ip, timestamps)
  }

  // Prune old entries
  while (timestamps.length > 0 && timestamps[0] < windowStart) {
    timestamps.shift()
  }

  if (timestamps.length >= RATE_LIMIT_MAX) return false

  timestamps.push(now)
  return true
}

// ─── Extract user ID from JWT ────────────────────────────────────────────────

export function extractUserId(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const payload = JSON.parse(
      Buffer.from(authHeader.split('.')[1], 'base64').toString()
    )
    return payload.sub ?? null
  } catch {
    return null
  }
}

// ─── Detect device type from User-Agent ──────────────────────────────────────

export function detectDeviceType(ua: string | undefined): 'ios' | 'android' | 'web' | null {
  if (!ua) return null
  const lower = ua.toLowerCase()
  if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('darwin')) return 'ios'
  if (lower.includes('android')) return 'android'
  if (lower.includes('mozilla') || lower.includes('chrome') || lower.includes('safari')) return 'web'
  return null
}
