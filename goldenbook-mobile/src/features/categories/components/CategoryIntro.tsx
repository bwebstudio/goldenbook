import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';

interface CategoryIntroProps {
  name: string;
  description: string | null;
  itemCount: number;
}

export function CategoryIntro({ name, description, itemCount }: CategoryIntroProps) {
  const t = useTranslation();
  return (
    <View className="px-6 pt-8 pb-6">
      <Text
        className="text-navy font-bold leading-tight mb-3"
        style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 32 }}
      >
        {name}
      </Text>

      {description ? (
        <Text className="text-navy/60 text-sm leading-relaxed mb-4">
          {description}
        </Text>
      ) : null}

      {itemCount > 0 && (
        <View className="flex-row items-center gap-1.5">
          <View className="w-1 h-1 rounded-full bg-primary" />
          <Text className="text-[10px] uppercase tracking-widest text-primary font-bold">
            {itemCount} {itemCount === 1 ? t.category.place : t.category.places}
          </Text>
        </View>
      )}
    </View>
  );
}