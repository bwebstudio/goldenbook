import { View, Text } from 'react-native';
import { RoutePlaceCard } from './RoutePlaceCard';
import { useTranslation } from '@/i18n';
import type { RoutePlaceDTO } from '../types';

interface RoutePlacesTimelineProps {
  places: RoutePlaceDTO[];
}

export function RoutePlacesTimeline({ places }: RoutePlacesTimelineProps) {
  const t = useTranslation();
  if (!places.length) return null;

  const sorted = [...places].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <View className="pt-2 pb-4">
      {/* Section label */}
      <Text className="text-[10px] font-bold tracking-widest uppercase text-primary px-6 mb-6">
        {t.routes.theRoute}
      </Text>

      {sorted.map((place, idx) => (
        <RoutePlaceCard
          key={place.id}
          place={place}
          index={idx}
          isLast={idx === sorted.length - 1}
        />
      ))}
    </View>
  );
}
