// The sanctioned way to navigate to a route detail screen, mirroring
// openPlace(). It stamps the origin on the `src` route param so the detail
// screen can attach it to route_start (and pass it on to route_complete).

import type { Router } from 'expo-router';
import type { PlaceSource } from '@/analytics/track';

export function openRoute(router: Router, slug: string, source: PlaceSource): void {
  router.push({
    pathname: '/routes/[slug]',
    params: { slug, src: source },
  } as never);
}
