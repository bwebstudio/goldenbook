import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { SearchRouteDTO } from '@/types/api';

interface Props {
  route: SearchRouteDTO;
}

export function SearchRouteRow({ route }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push(`/routes/${route.slug}` as any)}
      activeOpacity={0.9}
      className="bg-navy rounded-2xl px-5 py-5 border border-primary/15"
      style={{
        shadowColor: '#222D52',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <Text className="text-primary text-[9px] uppercase tracking-widest font-bold mb-2">
        Curated Route
      </Text>
      <Text className="text-ivory font-bold text-base leading-snug mb-1" numberOfLines={2}>
        {route.title}
      </Text>
      {route.summary && (
        <Text
          className="text-ivory/55 text-xs italic leading-relaxed font-light"
          numberOfLines={2}
        >
          {route.summary}
        </Text>
      )}
      <View className="flex-row items-center mt-3 gap-1.5">
        <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
          View Route
        </Text>
        <Ionicons name="arrow-forward" size={12} color="#D2B68A" />
      </View>
    </TouchableOpacity>
  );
}