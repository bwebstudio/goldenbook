import { View, Text } from 'react-native';
import { useTranslation } from '@/i18n';

interface EmptyCategoryStateProps {
  categoryName?: string;
}

export function EmptyCategoryState({ categoryName }: EmptyCategoryStateProps) {
  const t = useTranslation();
  const message = categoryName
    ? t.category.stillCuratingFor.replace('__NAME__', categoryName)
    : t.category.stillCurating;

  return (
    <View className="flex-1 items-center justify-center px-10 py-20">
      <Text className="text-2xl mb-4">✦</Text>
      <Text
        className="text-navy font-bold text-lg text-center mb-2"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {t.category.nothingHereYet}
      </Text>
      <Text className="text-navy/40 text-sm text-center leading-relaxed">
        {message}
      </Text>
    </View>
  );
}
