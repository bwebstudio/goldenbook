import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';

interface PlaceHeaderProps {
  name: string;
  cityName: string;
  rating: number | null;
  tags: string[];
}

export function PlaceHeader({ name, cityName, rating, tags }: PlaceHeaderProps) {
  const t = useTranslation();
  const stars = rating ? Math.round(Math.min(5, Math.max(0, rating))) : 0;

  return (
    <View className="px-8 pt-6 pb-4 items-center">
      {/* Editor's Favorite badge */}
      <View
        className="flex-row items-center gap-2 px-4 py-1.5 rounded-full mb-4"
        style={{
          backgroundColor: 'rgba(210,182,138,0.15)',
          borderWidth: 1,
          borderColor: 'rgba(210,182,138,0.3)',
        }}
      >
        <Text className="text-[10px] font-bold text-navy uppercase tracking-widest">
          {t.place.editorsFavorite}
        </Text>
      </View>

      {/* Place name — serif, large */}
      <Text
        className="text-4xl font-bold text-navy tracking-tight text-center leading-tight mb-3"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {name}
      </Text>

      {/* City + location row */}
      <View className="flex-row items-center gap-3 mb-4">
        <Text className="text-[11px] font-semibold tracking-widest text-navy/60 uppercase">
          {cityName}
        </Text>
        {tags.length > 0 && (
          <>
            <View className="w-1 h-1 rounded-full bg-primary/40" />
            <Text className="text-[11px] font-semibold tracking-widest text-navy/60 uppercase">
              {tags[0]}
            </Text>
          </>
        )}
      </View>

      {/* Stars */}
      {rating != null && (
        <View className="items-center gap-1">
          <View className="flex-row gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Text key={i} className="text-primary text-base">
                {i < stars ? '★' : '☆'}
              </Text>
            ))}
          </View>
          {rating >= 4.8 && (
            <Text className="text-[10px] font-bold text-navy/40 tracking-widest uppercase">
              {rating >= 4.9 ? t.place.threeMichelinStars : t.place.exceptional}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
