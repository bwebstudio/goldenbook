import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type Actions = PlaceDetailDTO['actions'];

interface PlaceActionsProps {
  actions: Actions;
  location?: { latitude: number | null; longitude: number | null };
  onSave?: () => void;
  isSaved?: boolean;
}

export function PlaceActions({ actions, location, onSave, isSaved = false }: PlaceActionsProps) {
  const router = useRouter();
  const t = useTranslation();

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Cannot open link'));
  };

  const handleReserve = () => {
    if (actions.bookingUrl) openUrl(actions.bookingUrl);
    else if (actions.reservationPhone) openUrl(`tel:${actions.reservationPhone}`);
  };

  const handleMap = () => {
    if (location?.latitude && location?.longitude) {
      router.push(`/map?lat=${location.latitude}&lng=${location.longitude}` as any);
    } else if (actions.navigateUrl) {
      openUrl(actions.navigateUrl);
    }
  };

  const canReserve = !!(actions.bookingUrl || actions.reservationPhone);
  const canShowMap = !!(location?.latitude && location?.longitude) || !!actions.navigateUrl;

  return (
    <View className="flex-row gap-4 px-8 py-4">
      {/* Reserve — primary action (navy, rounded-full) */}
      {canReserve && (
        <TouchableOpacity
          onPress={handleReserve}
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 bg-navy rounded-full"
          style={{ flex: 1.5, height: 56 }}
        >
          <Ionicons name="bookmark-outline" size={18} color="#FDFDFB" />
          <Text className="text-ivory text-xs font-bold uppercase tracking-widest">{t.place.reserve}</Text>
        </TouchableOpacity>
      )}

      {/* Map — secondary action (ivory, rounded-full) */}
      {canShowMap && (
        <TouchableOpacity
          onPress={handleMap}
          activeOpacity={0.85}
          className="flex-row items-center justify-center gap-2 rounded-full border border-navy/5"
          style={{
            flex: 1,
            height: 56,
            backgroundColor: '#FDFDFB',
            shadowColor: '#222D52',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <Ionicons name="navigate-outline" size={18} color="#D2B68A" />
          <Text className="text-navy text-xs font-bold uppercase tracking-widest">{t.place.map}</Text>
        </TouchableOpacity>
      )}

      {/* Save — icon only */}
      {actions.canSave && (
        <TouchableOpacity
          onPress={onSave ?? (() => {})}
          activeOpacity={0.8}
          className="items-center justify-center rounded-full border border-navy/5"
          style={{
            width: 56,
            height: 56,
            backgroundColor: '#FDFDFB',
            shadowColor: '#222D52',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color="#222D52"
          />
        </TouchableOpacity>
      )}

      {/* Website — icon only */}
      {actions.websiteUrl && (
        <TouchableOpacity
          onPress={() => openUrl(actions.websiteUrl!)}
          activeOpacity={0.8}
          className="items-center justify-center rounded-full border border-navy/5"
          style={{
            width: 56,
            height: 56,
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
  );
}
