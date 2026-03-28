import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '@/store/appStore';
import { useRouter } from 'expo-router';
import type { Destination } from '@/types/api';

interface Props {
  destination: Destination;
}

export function SearchDestinationRow({ destination }: Props) {
  const setCity = useAppStore((s) => s.setCity);
  const router = useRouter();

  const handlePress = () => {
    setCity(destination.slug);
    router.push('/(tabs)/' as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      className="flex-row items-center py-3 border-b border-navy/5"
    >
      {/* Icon badge */}
      <View
        className="flex-shrink-0 rounded-full items-center justify-center bg-ivory-soft mr-4"
        style={{ width: 44, height: 44 }}
      >
        <Ionicons name="compass-outline" size={20} color="#D2B68A" />
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-navy font-bold text-sm leading-snug">{destination.name}</Text>
        <Text className="text-navy/40 text-[11px] mt-0.5">{destination.country}</Text>
      </View>

      <View className="flex-row items-center gap-1">
        <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
          Explore
        </Text>
        <Ionicons name="chevron-forward" size={12} color="#D2B68A" />
      </View>
    </TouchableOpacity>
  );
}