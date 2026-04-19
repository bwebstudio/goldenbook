// Unified mobile analytics helper — single call site for every user-interaction
// event. Fire-and-forget: never awaits, never throws into the UI, never blocks
// navigation.
//
// Event payloads are minimal. The server enriches each row with user_id
// (from JWT), device_type / app_version (from x-* headers), and city / locale
// (from the user_sessions row + session_id). Clients cannot spoof those.
//
// Usage:
//   track('place_view', { placeId, source: 'discover' })
//   track('booking_click', { placeId, metadata: { provider: 'booking.com' } })

import { apiClient, SESSION_ID } from '@/api/client';

export type AnalyticsEventName =
  | 'app_session_start'
  | 'app_session_end'
  | 'place_view'
  | 'place_open'
  | 'map_open'
  | 'website_click'
  | 'booking_click'
  | 'favorite_add'
  | 'favorite_remove'
  | 'search_query'
  | 'search_result_click'
  | 'now_used'
  | 'concierge_used'
  | 'route_start'
  | 'route_complete';

export interface TrackProps {
  placeId?: string;
  routeId?: string;
  category?: string;
  source?: 'discover' | 'map' | 'search' | 'saved' | 'route' | 'concierge' | 'deep_link';
  metadata?: Record<string, unknown>;
}

/**
 * Fire a tracking event. Never throws, never awaits the network.
 * Safe to call from render paths, effects, and callbacks alike.
 */
export function track(event: AnalyticsEventName, props: TrackProps = {}): void {
  const payload = {
    event,
    ...(props.placeId  ? { placeId:  props.placeId  } : {}),
    ...(props.routeId  ? { routeId:  props.routeId  } : {}),
    ...(props.category ? { category: props.category } : {}),
    ...(props.source   ? { source:   props.source   } : {}),
    ...(props.metadata ? { metadata: props.metadata } : {}),
  };

  apiClient
    .post('/analytics/events', payload)
    .catch(() => {
      // Analytics is never allowed to surface an error in the UI.
    });
}

// ─── Session helpers ────────────────────────────────────────────────────────

export interface SessionContext {
  locale?: string;
  city?: string;
  appVersion?: string;
  deviceType?: 'ios' | 'android' | 'web';
}

export function sessionStart(ctx: SessionContext): void {
  apiClient
    .post('/analytics/sessions/start', { sessionId: SESSION_ID, ...ctx })
    .catch(() => {});
}

export function sessionPing(): void {
  apiClient
    .post('/analytics/sessions/ping', { sessionId: SESSION_ID })
    .catch(() => {});
}

export function sessionEnd(): void {
  apiClient
    .post('/analytics/sessions/end', { sessionId: SESSION_ID })
    .catch(() => {});
}
