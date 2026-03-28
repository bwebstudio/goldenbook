import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DiscoverCategory } from '../types';

interface CategoryPillsProps {
  categories: DiscoverCategory[];
}

export function CategoryPills({ categories }: CategoryPillsProps) {
  const router = useRouter();

  if (!categories.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
    >
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.id}
          onPress={() => router.push(`/categories/${cat.slug}` as any)}
          activeOpacity={0.8}
          className="border border-navy/10 rounded-full px-4 py-2"
        >
          <Text className="text-xs font-medium text-navy/60 tracking-wide">{cat.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
