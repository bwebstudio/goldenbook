import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from '@/i18n';

interface SectionHeaderProps {
  title: string;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, onSeeAll }: SectionHeaderProps) {
  const t = useTranslation();
  return (
    <View className="flex-row items-end justify-between px-6 mb-5 mt-7">
      <Text className="text-xl font-bold text-navy tracking-tight">{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text
            className="text-[9px] uppercase tracking-widest font-bold text-primary"
            style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(210,182,138,0.4)', paddingBottom: 2 }}
          >
            {t.discover.seeAll}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
