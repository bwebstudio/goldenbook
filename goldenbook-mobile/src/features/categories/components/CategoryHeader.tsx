import { TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CategoryHeaderProps {
  title: string;
  cityName?: string;
}

export function CategoryHeader({ title, cityName }: CategoryHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-ivory flex-row items-center px-5 pb-4 border-b border-navy/5"
      style={{ paddingTop: insets.top + 8 }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        activeOpacity={0.7}
        className="mr-3 p-1"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={22} color="#222D52" />
      </TouchableOpacity>

      <View className="flex-1">
        <Text
          className="text-navy font-bold text-base leading-tight"
          numberOfLines={1}
        >
          {title}
        </Text>
        {cityName && (
          <Text className="text-[10px] uppercase tracking-widest text-primary font-bold mt-0.5">
            {cityName}
          </Text>
        )}
      </View>
    </View>
  );
}