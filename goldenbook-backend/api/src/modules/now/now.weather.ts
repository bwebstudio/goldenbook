// ─── Weather Service ─────────────────────────────────────────────────────────
//
// Lightweight weather integration using Open-Meteo (free, no API key required).
// Cached per city coordinates for 15 minutes.
// Falls back gracefully — weather is a boost signal, never a blocker.

import type { WeatherCondition } from './now.moments'

// ─── Cache ───────────────────────────────────────────────────────────────────

interface WeatherCacheEntry {
  condition: WeatherCondition
  temperature: number
  fetchedAt: number
}

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
const weatherCache = new Map<string, WeatherCacheEntry>()

function cacheKey(lat: number, lon: number): string {
  // Round to 2 decimal places (~1km precision) for cache grouping
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

// ─── Open-Meteo integration ──────────────────────────────────────────────────

// WMO Weather interpretation codes → condition mapping
// See: https://open-meteo.com/en/docs#weathervariables
function wmoToCondition(code: number, temperature: number): WeatherCondition {
  // Rain / drizzle / thunderstorm / snow
  if (code >= 51 && code <= 99) return 'rainy'
  // Fog / depositing rime fog
  if (code >= 45 && code <= 48) return 'cloudy'
  // Overcast
  if (code >= 3 && code <= 3) return 'cloudy'
  // Partly cloudy
  if (code >= 1 && code <= 2) {
    // Use temperature to distinguish hot/cold on partly cloudy days
    if (temperature >= 30) return 'hot'
    if (temperature <= 10) return 'cold'
    return 'sunny' // mild partly cloudy = effectively sunny
  }
  // Clear sky
  if (code === 0) {
    if (temperature >= 32) return 'hot'
    if (temperature <= 8) return 'cold'
    return 'sunny'
  }
  // Default
  return 'cloudy'
}

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number
    weather_code?: number
  }
}

/**
 * Fetch current weather for a location.
 * Returns null on failure — callers should treat weather as optional.
 */
export async function getWeather(
  latitude: number,
  longitude: number,
): Promise<{ condition: WeatherCondition; temperature: number } | null> {
  const key = cacheKey(latitude, longitude)

  // Check cache
  const cached = weatherCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { condition: cached.condition, temperature: cached.temperature }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) return null

    const data = (await response.json()) as OpenMeteoResponse

    const temperature = data.current?.temperature_2m ?? 20
    const weatherCode = data.current?.weather_code ?? 0
    const condition = wmoToCondition(weatherCode, temperature)

    // Update cache
    weatherCache.set(key, { condition, temperature, fetchedAt: Date.now() })

    return { condition, temperature }
  } catch {
    // Network error, timeout, etc. — weather is optional
    return null
  }
}

// ─── City coordinate defaults ────────────────────────────────────────────────
//
// Fallback coordinates for known cities when user location is not available.
// Used to fetch weather when we only have a city slug.

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  // Portugal — active cities in the app
  lisboa:    { lat: 38.7223, lon: -9.1393 },
  lisbon:    { lat: 38.7223, lon: -9.1393 },  // alias
  porto:     { lat: 41.1579, lon: -8.6291 },
  algarve:   { lat: 37.0194, lon: -7.9304 },  // Faro region
  madeira:   { lat: 32.6669, lon: -16.9241 }, // Funchal
  // Future cities
  barcelona: { lat: 41.3874, lon: 2.1686 },
  madrid:    { lat: 40.4168, lon: -3.7038 },
  paris:     { lat: 48.8566, lon: 2.3522 },
  london:    { lat: 51.5074, lon: -0.1278 },
  rome:      { lat: 41.9028, lon: 12.4964 },
  milan:     { lat: 45.4642, lon: 9.1900 },
  amsterdam: { lat: 52.3676, lon: 4.9041 },
  berlin:    { lat: 52.5200, lon: 13.4050 },
}

/**
 * Get weather for a city by slug. Uses fallback coordinates if available.
 * Returns null if city is unknown or weather fetch fails.
 */
export async function getWeatherForCity(
  citySlug: string,
): Promise<{ condition: WeatherCondition; temperature: number } | null> {
  const coords = CITY_COORDS[citySlug]
  if (!coords) return null
  return getWeather(coords.lat, coords.lon)
}

/**
 * Get weather using user coordinates (preferred) or city slug (fallback).
 */
export async function resolveWeather(
  userLat?: number,
  userLon?: number,
  citySlug?: string,
): Promise<{ condition: WeatherCondition; temperature: number } | null> {
  if (userLat != null && userLon != null) {
    return getWeather(userLat, userLon)
  }
  if (citySlug) {
    return getWeatherForCity(citySlug)
  }
  return null
}