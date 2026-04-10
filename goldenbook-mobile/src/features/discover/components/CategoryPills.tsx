import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DiscoverCategory } from '../types';

interface CategoryPillsProps {
  categories: DiscoverCategory[];
}

export function CategoryPills({ categories }: CategoryPillsProps) {
  const router = useRouter();

  if (!categories.length) return null;

  return (
    <View
      className="flex-row flex-wrap"
      style={{ paddingHorizontal: 20, gap: 10 }}
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          onPress={() => router.push(`/categories/${cat.slug}` as any)}
          activeOpacity={0.8}
          className="border border-navy/10 rounded-full items-center justify-center"
          style={{ paddingHorizontal: 18, paddingVertical: 10 }}
        >
          <Text className="text-[13px] font-medium text-navy/65 tracking-wide">{cat.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
