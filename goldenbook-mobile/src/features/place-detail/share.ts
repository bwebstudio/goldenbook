import { Share, Platform, Alert } from 'react-native';

// ── Share URLs ──────────────────────────────────────────────────────────────
//
// The web (goldenbook.app) is a marketing site. It has NO place or route
// detail pages — only /, /about, /contact, /privacy, /terms. Sharing a URL
// like https://goldenbook.app/places/foo gives the recipient a 404.
//
// Instead we share the App Store link so the recipient can download the app
// directly, with the place/route description as contextual text. This is
// standard for app-only products (Tinder, Bumble, etc. all do this).

const APP_STORE_URL = 'https://apps.apple.com/app/id6748363796';

interface SharePlacePayload {
  name: string;
  slug: string;
  cityName?: string;
  shortDescription?: string | null;
}

export async function sharePlace(place: SharePlacePayload): Promise<void> {
  const headline = place.cityName
    ? `${place.name} — ${place.cityName}`
    : place.name;

  const parts = [headline];
  if (place.shortDescription) parts.push(place.shortDescription);
  parts.push(`Discover it on Goldenbook Go\n${APP_STORE_URL}`);

  const message = parts.join('\n\n');

  try {
    await Share.share(
      Platform.select({
        ios: { message },
        default: { message, title: headline },
      })!,
      { dialogTitle: headline },
    );
  } catch (err) {
    if (__DEV__) console.warn('[sharePlace] failed:', err);
    Alert.alert('', 'Could not open the share sheet. Please try again.');
  }
}

interface ShareRoutePayload {
  title: string;
  slug: string;
  cityName?: string;
  summary?: string | null;
}

export async function shareRoute(route: ShareRoutePayload): Promise<void> {
  const headline = route.cityName
    ? `${route.title} — ${route.cityName}`
    : route.title;

  const parts = [headline];
  if (route.summary) parts.push(route.summary);
  parts.push(`Discover it on Goldenbook Go\n${APP_STORE_URL}`);

  const message = parts.join('\n\n');

  try {
    await Share.share(
      Platform.select({
        ios: { message },
        default: { message, title: headline },
      })!,
      { dialogTitle: headline },
    );
  } catch (err) {
    if (__DEV__) console.warn('[shareRoute] failed:', err);
    Alert.alert('', 'Could not open the share sheet. Please try again.');
  }
}
