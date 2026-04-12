import { Share, Platform, Alert } from 'react-native';

const PUBLIC_BASE_URL = 'https://goldenbook.app';

interface SharePlacePayload {
  name: string;
  slug: string;
  cityName?: string;
  shortDescription?: string | null;
}

/**
 * Share a place using the OS share sheet.
 * Falls back to a soft alert if the system rejects the request (e.g. iOS
 * cancellation already throws inside Share.share — that's swallowed silently).
 */
export async function sharePlace(place: SharePlacePayload): Promise<void> {
  const url = `${PUBLIC_BASE_URL}/places/${place.slug}`;
  const headline = place.cityName
    ? `${place.name} — ${place.cityName} on Goldenbook`
    : `${place.name} on Goldenbook`;
  const message = place.shortDescription
    ? `${headline}\n\n${place.shortDescription}\n${url}`
    : `${headline}\n${url}`;

  try {
    await Share.share(
      Platform.select({
        ios: { url, message: headline },
        default: { message, title: headline },
      })!,
      { dialogTitle: headline },
    );
  } catch (err) {
    // Sharing was rejected for a real reason (not user cancel). Surface a
    // gentle alert so the button doesn't feel completely broken.
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
  const url = `${PUBLIC_BASE_URL}/routes/${route.slug}`;
  const headline = route.cityName
    ? `${route.title} — ${route.cityName} on Goldenbook`
    : `${route.title} on Goldenbook`;
  const message = route.summary
    ? `${headline}\n\n${route.summary}\n${url}`
    : `${headline}\n${url}`;

  try {
    await Share.share(
      Platform.select({
        ios: { url, message: headline },
        default: { message, title: headline },
      })!,
      { dialogTitle: headline },
    );
  } catch (err) {
    if (__DEV__) console.warn('[shareRoute] failed:', err);
    Alert.alert('', 'Could not open the share sheet. Please try again.');
  }
}
