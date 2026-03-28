import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { SubcategoryDTO } from '../types';

interface SubcategoryChipsProps {
  subcategories: SubcategoryDTO[];
  activeSlug?: string;
}

export function SubcategoryChips({ subcategories, activeSlug }: SubcategoryChipsProps) {
  const router = useRouter();

  if (!subcategories.length) return null;

  return (
    <View className="mb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
      >
        {subcategories.map((sub) => {
          const isActive = sub.slug === activeSlug;
          return (
            <TouchableOpacity
              key={sub.slug}
              onPress={() => router.push(`/categories/${sub.slug}` as any)}
              activeOpacity={0.75}
              className={
                isActive
                  ? 'bg-navy rounded-full px-4 py-2'
                  : 'border border-navy/15 rounded-full px-4 py-2'
              }
            >
              <Text
                className={
                  isActive
                    ? 'text-xs font-bold text-ivory tracking-wide'
                    : 'text-xs font-medium text-navy/60 tracking-wide'
                }
              >
                {sub.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}