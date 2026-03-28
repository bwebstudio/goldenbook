import { View, Text } from 'react-native';
import { CategoryPlaceCard } from './CategoryPlaceCard';
import type { CategoryPlaceDTO } from '../types';

interface CategoryPlaceGridProps {
  places: CategoryPlaceDTO[];
  title?: string;
}

export function CategoryPlaceGrid({ places, title }: CategoryPlaceGridProps) {
  if (!places.length) return null;

  // Pair items into rows of 2
  const rows: CategoryPlaceDTO[][] = [];
  for (let i = 0; i < places.length; i += 2) {
    rows.push(places.slice(i, i + 2));
  }

  return (
    <View className="px-6">
      {title && (
        <Text className="text-[10px] uppercase tracking-widest text-navy/40 font-bold mb-4">
          {title}
        </Text>
      )}

      <View className="gap-3">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-3">
            {row.map((place) => (
              <CategoryPlaceCard key={place.id} place={place} />
            ))}
            {/* Fill empty slot if odd number of items */}
            {row.length === 1 && <View className="flex-1" />}
          </View>
        ))}
      </View>
    </View>
  );
}