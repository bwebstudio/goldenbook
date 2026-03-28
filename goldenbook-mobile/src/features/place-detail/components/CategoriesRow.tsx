import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

interface Category {
  id: string;
  slug: string;
  name: string;
}

interface CategoriesRowProps {
  categories: Category[];
  subcategories: Category[];
}

export function CategoriesRow({ categories, subcategories }: CategoriesRowProps) {
  const router = useRouter();

  if (!categories.length && !subcategories.length) return null;

  return (
    <View className="pb-3">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => router.push(`/categories/${cat.slug}` as any)}
            className="rounded-full px-4 py-1.5"
            style={{
              backgroundColor: 'rgba(210,182,138,0.18)',
              borderWidth: 1,
              borderColor: 'rgba(210,182,138,0.35)',
            }}
          >
            <Text
              className="text-[10px] font-bold text-navy uppercase tracking-widest"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
        {subcategories.map((sub) => (
          <TouchableOpacity
            key={sub.id}
            onPress={() => router.push(`/categories/${sub.slug}` as any)}
            className="rounded-full px-4 py-1.5"
            style={{ borderWidth: 1, borderColor: 'rgba(34,45,82,0.18)' }}
          >
            <Text
              className="text-[10px] text-navy/55 tracking-widest"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {sub.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
