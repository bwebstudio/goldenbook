import { db } from '../../db/postgres'

export interface TrackingEvent {
  placeId: string
  provider: string
  bookingMode: string
  targetUrl: string | null
  userId: string | null
  sessionId: string | null
  deviceType: string | null
  locale: string | null
  city: string | null
}

export async function recordBookingClick(event: TrackingEvent): Promise<void> {
  await db.query(`
    INSERT INTO booking_click_events (
      place_id, provider, booking_mode, target_url,
      user_id, session_id, device_type, locale, city
    ) VALUES (
      $1, $2::booking_provider, $3, $4,
      $5, $6, $7::click_device_type, $8, $9
    )
  `, [
    event.placeId, event.provider, event.bookingMode, event.targetUrl,
    event.userId, event.sessionId, event.deviceType, event.locale, event.city,
  ])
}

export async function recordBookingImpression(event: TrackingEvent): Promise<void> {
  await db.query(`
    INSERT INTO booking_impression_events (
      place_id, provider, booking_mode, target_url,
      user_id, session_id, device_type, locale, city
    ) VALUES (
      $1, $2::booking_provider, $3, $4,
      $5, $6, $7::click_device_type, $8, $9
    )
  `, [
    event.placeId, event.provider, event.bookingMode, event.targetUrl,
    event.userId, event.sessionId, event.deviceType, event.locale, event.city,
  ])
}
