import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DiscoverHeaderProps {
  cityName: string;
  country: string;
  onCityPress?: () => void;
  onMenuPress?: () => void;
}

export function DiscoverHeader({ cityName, country, onCityPress, onMenuPress }: DiscoverHeaderProps) {
  return (
    <View className="px-6 pt-8 pb-2 flex-row items-start justify-between">
      {/* City + country */}
      <TouchableOpacity onPress={onCityPress} activeOpacity={0.7}>
        <Text
          className="text-3xl tracking-tight text-navy"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {cityName}
        </Text>
        <Text className="text-[10px] uppercase tracking-widest text-primary font-bold mt-1">
          {country}
        </Text>
      </TouchableOpacity>

      {/* Menu button */}
      <TouchableOpacity
        onPress={onMenuPress}
        activeOpacity={0.7}
        className="w-10 h-10 items-center justify-center rounded-full bg-navy/5"
      >
        <Ionicons name="menu" size={22} color="#222D52" />
      </TouchableOpacity>
    </View>
  );
}
