import { useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type Actions = PlaceDetailDTO['actions'];

interface PlaceActionsProps {
  placeId: string;
  actions: Actions;
  location?: { latitude: number | null; longitude: number | null };
  city?: string;
  onSave?: () => void;
  isSaved?: boolean;
  isSaving?: boolean;
}

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\/.+/i.test(url.trim());
}

/**
 * Action bar below the hero. Only 4 possible buttons:
 *
 *   [RESERVE]  [MAP]  [SAVE ♡]  [🌐 WEB]
 *
 * Rules:
 *   - RESERVE: only when there's a phone number or a direct booking URL
 *              (NOT affiliate platforms like Viator/TheFork/GetYourGuide)
 *   - MAP:     when coordinates or a navigateUrl exist
 *   - SAVE:    always (canSave is true for all published places)
 *   - WEB:     when the venue has its own website (globe icon, no text label)
 *
 * The old "VISITAR SITIO WEB" / "OPEN WEBSITE" text button is gone.
 * Goldenbook does not use affiliate links (Viator, TheFork, etc.).
 */
export function PlaceActions({
  placeId,
  actions,
  location,
  city,
  onSave,
  isSaved = false,
  isSaving = false,
}: PlaceActionsProps) {
  const router = useRouter();
  const t = useTranslation();

  const openUrl = (url: string) => {
    Linking.openURL(url.trim()).catch(() => Alert.alert('Cannot open link'));
  };

  // ── Reserve: phone or direct booking URL (never affiliate) ────────────
  const canReserve = !!(actions.reservationPhone || actions.bookingUrl);
  const handleReserve = () => {
    if (actions.reservationPhone) openUrl(`tel:${actions.reservationPhone}`);
    else if (actions.bookingUrl) openUrl(actions.bookingUrl);
  };
  const reserveLabel = actions.reservationPhone && !actions.bookingUrl
    ? t.place.reserve
    : t.place.visitWebsite;

  // ── Map ───────────────────────────────────────────────────────────────
  const canShowMap = !!(location?.latitude && location?.longitude) || !!actions.navigateUrl;
  const handleMap = () => {
    if (location?.latitude && location?.longitude) {
      router.push(`/map?lat=${location.latitude}&lng=${location.longitude}` as any);
    } else if (actions.navigateUrl) {
      openUrl(actions.navigateUrl);
    }
  };

  // ── Website (globe icon only, no text) ────────────────────────────────
  const canShowWeb = isHttpUrl(actions.websiteUrl);

  return (
    <View className="px-5 pt-6 pb-2">
      <View className="flex-row gap-3">
        {/* Reserve — only direct booking, never affiliate */}
        {canReserve && (
          <TouchableOpacity
            onPress={handleReserve}
            activeOpacity={0.85}
            className="items-center justify-center bg-navy rounded-full"
            style={{ flex: 1, height: 48 }}
            accessibilityRole="link"
          >
            <Text className="text-ivory text-[10px] font-bold uppercase tracking-widest" numberOfLines={1}>
              {reserveLabel}
            </Text>
          </TouchableOpacity>
        )}

        {/* Map */}
        {canShowMap && (
          <TouchableOpacity
            onPress={handleMap}
            activeOpacity={0.85}
            className="flex-row items-center justify-center gap-2 rounded-full border border-navy/5"
            style={{
              flex: 1,
              height: 48,
              backgroundColor: '#FDFDFB',
              shadowColor: '#222D52',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <Ionicons name="navigate-outline" size={18} color="#D2B68A" />
            <Text className="text-navy text-[10px] font-bold uppercase tracking-widest">{t.place.map}</Text>
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
              width: 48,
              height: 48,
              backgroundColor: '#FDFDFB',
              shadowColor: '#222D52',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 1,
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

        {/* Website (globe icon only — no "VISITAR SITIO WEB" text button) */}
        {canShowWeb && (
          <TouchableOpacity
            onPress={() => openUrl(actions.websiteUrl!)}
            activeOpacity={0.6}
            className="items-center justify-center rounded-full border border-navy/5"
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#FDFDFB',
              shadowColor: '#222D52',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 1,
            }}
          >
            <Ionicons name="globe-outline" size={20} color="#222D52" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
