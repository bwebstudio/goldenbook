import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/i18n';

interface DiscoverSearchBarProps {
  placeholder?: string;
}

export function DiscoverSearchBar({ placeholder }: DiscoverSearchBarProps) {
  const router = useRouter();
  const t = useTranslation();

  return (
    <TouchableOpacity
      onPress={() => router.push('/search' as any)}
      activeOpacity={0.8}
      className="mx-6 my-4"
    >
      <View
        className="flex-row items-center bg-white border border-navy/5 rounded-xl px-4 h-12 gap-3"
        style={{
          shadowColor: '#222D52',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <Ionicons name="search" size={18} color="#888" />
        <TextInput
          className="flex-1 text-sm text-navy/60"
          placeholder={placeholder ?? t.discover.searchPlaceholder}
          placeholderTextColor="#aaa"
          editable={false}
          pointerEvents="none"
        />
      </View>
    </TouchableOpacity>
  );
}
