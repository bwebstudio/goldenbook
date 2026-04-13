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
 * Action bar below the hero image. Maximum 4 buttons:
 *
 *   [WEBSITE]  [MAP]  [SAVE ♡]  [CALL]
 *
 * Rules:
 *   - WEBSITE: only the venue's own websiteUrl. Never affiliate links.
 *   - MAP: when coordinates or navigateUrl exist.
 *   - SAVE: always.
 *   - CALL: only when a phone number exists.
 *
 * NO globe icon. NO booking CTA. NO Viator/TheFork/Booking/affiliate.
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

  // ── Website: only the venue's own site ────────────────────────────────
  const hasWebsite = isHttpUrl(actions.websiteUrl);

  // ── Phone: direct call ────────────────────────────────────────────────
  const hasPhone = !!actions.reservationPhone;

  // ── Map ───────────────────────────────────────────────────────────────
  const canShowMap = !!(location?.latitude && location?.longitude) || !!actions.navigateUrl;
  const handleMap = () => {
    if (location?.latitude && location?.longitude) {
      router.push(`/map?lat=${location.latitude}&lng=${location.longitude}` as any);
    } else if (actions.navigateUrl) {
      openUrl(actions.navigateUrl);
    }
  };

  return (
    <View className="px-5 pt-6 pb-2">
      <View className="flex-row gap-3">
        {/* Website — the venue's own site, never affiliate */}
        {hasWebsite && (
          <TouchableOpacity
            onPress={() => openUrl(actions.websiteUrl!)}
            activeOpacity={0.85}
            className="items-center justify-center bg-navy rounded-full"
            style={{ flex: 1, height: 48 }}
            accessibilityRole="link"
          >
            <Text className="text-ivory text-[10px] font-bold uppercase tracking-widest" numberOfLines={1}>
              {t.place.visitWebsite}
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

        {/* Call */}
        {hasPhone && (
          <TouchableOpacity
            onPress={() => openUrl(`tel:${actions.reservationPhone}`)}
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
            <Ionicons name="call-outline" size={20} color="#222D52" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
