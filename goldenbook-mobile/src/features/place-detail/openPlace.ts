// The single sanctioned way to navigate to a place detail screen.
//
// Before this existed, every card did its own `router.push('/places/' + slug)`
// and some of them fired `place_open` with a hand-typed source while others
// fired nothing at all. The result: `source` was present on 0,6% of recorded
// events, so we could not tell whether people reached a place from Discover,
// the map, search or a route.
//
// Going through here means the origin is recorded twice over: once on the
// `place_open` event, and once as a route param the detail screen reads back
// so `place_view` carries it too. Those two are what make the funnel legible.

import type { Router } from 'expo-router';
import { track, type PlaceSource } from '@/analytics/track';

export interface OpenPlaceOptions {
  /** Where the tap happened. Required: an unattributed open is a blind spot. */
  source: PlaceSource;
  /** Place UUID. Omit only when the card genuinely doesn't have it yet. */
  placeId?: string;
  /** Primary category slug of the place, when the card knows it. */
  category?: string | null;
  /** Position in a list, carousel or result set, when there is one. */
  rank?: number;
  /** Anything else worth knowing about the context of the tap. */
  metadata?: Record<string, unknown>;
}

export function openPlace(
  router: Router,
  slug: string,
  { source, placeId, category, rank, metadata }: OpenPlaceOptions,
): void {
  if (placeId) {
    track('place_open', {
      placeId,
      source,
      ...(category ? { category } : {}),
      ...(rank != null || metadata
        ? { metadata: { ...(rank != null ? { rank } : {}), ...metadata } }
        : {}),
    });
  }

  router.push({
    pathname: '/places/[slug]',
    params: { slug, src: source },
  } as never);
}

// Reads the origin back off the route params on the detail screen. Anything
// unrecognised collapses to the fallback rather than being stored as free
// text, so the reports keep a closed vocabulary.
const KNOWN_SOURCES: readonly PlaceSource[] = [
  'discover', 'now', 'map', 'search', 'saved', 'plan', 'route', 'routes',
  'category', 'place', 'nearby', 'concierge', 'notification', 'deep_link', 'direct',
];

/**
 * Default for a detail screen opened without a `src` param. Every in-app
 * entry point goes through openPlace() / openRoute(), which always set one,
 * so a missing param means the screen was reached from outside the app (a
 * universal link, a notification URL). Both copies of each detail route use
 * this same default so one navigation is never logged two different ways.
 */
export const DETAIL_DEFAULT_SOURCE: PlaceSource = 'deep_link';

export function parsePlaceSource(raw: unknown, fallback: PlaceSource = DETAIL_DEFAULT_SOURCE): PlaceSource {
  return typeof raw === 'string' && (KNOWN_SOURCES as readonly string[]).includes(raw)
    ? (raw as PlaceSource)
    : fallback;
}
