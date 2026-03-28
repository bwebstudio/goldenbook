import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { SearchCategoryDTO } from '@/types/api';

interface Props {
  category: SearchCategoryDTO;
}

export function SearchCategoryRow({ category }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/categories/${category.slug}` as any)}
      activeOpacity={0.85}
      className="flex-row items-center py-3 border-b border-navy/5"
    >
      <View
        className="flex-shrink-0 rounded-full items-center justify-center bg-ivory-soft mr-4"
        style={{ width: 44, height: 44 }}
      >
        <Ionicons name="grid-outline" size={18} color="#D2B68A" />
      </View>

      <Text className="flex-1 text-navy font-bold text-sm">{category.name}</Text>

      <View className="flex-row items-center gap-1">
        <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
          Explore
        </Text>
        <Ionicons name="chevron-forward" size={12} color="#D2B68A" />
      </View>
    </TouchableOpacity>
  );
}