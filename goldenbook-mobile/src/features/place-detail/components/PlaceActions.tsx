import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { api } from '@/api/endpoints';
import type { PlaceDetailDTO, BookingCTA } from '../types';

type Actions = PlaceDetailDTO['actions'];
type Booking = PlaceDetailDTO['booking'];

interface PlaceActionsProps {
  placeId: string;
  actions: Actions;
  booking?: Booking;
  location?: { latitude: number | null; longitude: number | null };
  city?: string;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
}

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\/.+/i.test(url.trim());
}

export function PlaceActions({ placeId, actions, booking, location, city, onSave, isSaved = false, isSaving = false }: PlaceActionsProps) {
  const router = useRouter();
  const t = useTranslation();
  const impressionSent = useRef(false);

  const openUrl = (url: string) => {
    Linking.openURL(url.trim()).catch(() => Alert.alert('Cannot open link'));
  };

  const cta = booking?.cta ?? null;
  const hasBookingCTA = booking?.enabled && cta !== null && isHttpUrl(cta.url);

  // Track impression once per mount when CTA is visible
  useEffect(() => {
    if (!hasBookingCTA || !cta || impressionSent.current) return;
    impressionSent.current = true;

    api.trackBookingImpression({
      placeId,
      provider: cta.platform,
      bookingMode: cta.mode,
      targetUrl: cta.url ?? undefined,
      city: city ?? undefined,
    });
  }, [hasBookingCTA, cta, placeId, city]);

  const handleBookingCTA = () => {
    if (!cta?.url) return;

    // Fire tracking — never blocks URL opening
    api.trackBookingClick({
      placeId,
      provider: cta.platform,
      bookingMode: cta.mode,
      targetUrl: cta.url,
      city: city ?? undefined,
    });

    // Open the booking URL
    openUrl(cta.url);
  };

  // Legacy fallback — only when new booking system isn't active
  const canLegacyReserve = !hasBookingCTA && !!(actions.bookingUrl || actions.reservationPhone);

  const handleLegacyReserve = () => {
    if (actions.bookingUrl) openUrl(actions.bookingUrl);
    else if (actions.reservationPhone) openUrl(`tel:${actions.reservationPhone}`);
  };

  // ── CTA label resolver ──────────────────────────────────────────────────
  // We currently have NO active affiliate / partner integration. Labels must
  // describe what the link actually does, without implying a partnership:
  //   • "Reserve"        → only when the URL is clearly a reservation flow
  //                        for this venue (contact-to-reserve, tel:).
  //   • "Visit website"  → the venue's own website / own booking page.
  //   • "Open website"   → any other generic external page.
  const resolveBookingLabel = (c: BookingCTA): string => {
    if (c.platform === 'website') return t.place.visitWebsite;
    if (c.platform === 'contact') return t.place.reserve;
    // booking / thefork / viator / getyourguide and any unknown platform:
    // we cannot claim this is a reservation flow we operate, so we just
    // describe it as a generic external page.
    return t.place.openWebsite;
  };

  const handleMap = () => {
    if (location?.latitude && location?.longitude) {
      router.push(`/map?lat=${location.latitude}&lng=${location.longitude}` as any);
    } else if (actions.navigateUrl) {
      openUrl(actions.navigateUrl);
    }
  };

  const canShowMap = !!(location?.latitude && location?.longitude) || !!actions.navigateUrl;

  // Legacy reserve label: tel: link is a clear reservation flow → "Reserve".
  // A bookingUrl in the legacy path is the venue's own page → "Visit website".
  const legacyReserveLabel = actions.reservationPhone && !actions.bookingUrl
    ? t.place.reserve
    : t.place.visitWebsite;

  return (
    <View className="px-8 pt-6 pb-2">
      <View className="flex-row gap-3">
        {/* Primary CTA — label depends on what the link actually opens */}
        {hasBookingCTA && cta && (
          <TouchableOpacity
            onPress={handleBookingCTA}
            activeOpacity={0.85}
            className="items-center justify-center bg-navy rounded-full"
            style={{ flex: 1.5, height: 48 }}
            accessibilityRole="link"
          >
            <Text className="text-ivory text-xs font-bold uppercase tracking-widest">
              {resolveBookingLabel(cta)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Legacy reserve / website */}
        {canLegacyReserve && (
          <TouchableOpacity
            onPress={handleLegacyReserve}
            activeOpacity={0.85}
            className="items-center justify-center bg-navy rounded-full"
            style={{ flex: 1.5, height: 48 }}
            accessibilityRole="link"
          >
            <Text className="text-ivory text-xs font-bold uppercase tracking-widest">{legacyReserveLabel}</Text>
          </TouchableOpacity>
        )}

        {/* Map */}
        {canShowMap && (
          <TouchableOpacity
            onPress={handleMap}
            activeOpacity={0.85}
            className="flex-row items-center justify-center gap-2 rounded-full border border-navy/5"
            style={{
              flex: 1, height: 48, backgroundColor: '#FDFDFB',
              shadowColor: '#222D52', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
            }}
          >
            <Ionicons name="navigate-outline" size={18} color="#D2B68A" />
            <Text className="text-navy text-xs font-bold uppercase tracking-widest">{t.place.map}</Text>
          </TouchableOpacity>
        )}

        {/* Save (heart) */}
        {actions.canSave && onSave && (
          <TouchableOpacity
            onPress={onSave}
            disabled={isSaving}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
            className="items-center justify-center rounded-full border border-navy/5"
            style={{
              width: 48, height: 48, backgroundColor: '#FDFDFB',
              shadowColor: '#222D52', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaving ? 'rgba(210,182,138,0.6)' : isSaved ? '#D2B68A' : '#222D52'}
            />
          </TouchableOpacity>
        )}

        {/* Website — only when no booking CTA is active (avoid two URL buttons) */}
        {!hasBookingCTA && actions.websiteUrl && (
          <TouchableOpacity
            onPress={() => openUrl(actions.websiteUrl!)}
            activeOpacity={0.8}
            className="items-center justify-center rounded-full border border-navy/5"
            style={{
              width: 48, height: 48, backgroundColor: '#FDFDFB',
              shadowColor: '#222D52', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1,
            }}
          >
            <Ionicons name="globe-outline" size={20} color="#222D52" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
