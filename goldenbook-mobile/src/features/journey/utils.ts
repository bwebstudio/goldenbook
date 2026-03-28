import { Linking, Platform } from 'react-native';

export function openInMaps(
  name: string,
  lat?: number | null,
  lng?: number | null,
  address?: string | null,
) {
  const encodedName = encodeURIComponent(name);

  if (lat != null && lng != null) {
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${encodedName}&ll=${lat},${lng}`
        : `geo:${lat},${lng}?q=${encodedName}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
    });
  } else if (address) {
    const encodedAddr = encodeURIComponent(address);
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${encodedAddr}`
        : `geo:0,0?q=${encodedAddr}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${encodedAddr}`);
    });
  }
}

export function formatStayTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `~${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
}
