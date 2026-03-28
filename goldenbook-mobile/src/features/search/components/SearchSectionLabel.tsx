import { View, Text } from 'react-native';

interface Props {
  label: string;
  count?: number;
}

export function SearchSectionLabel({ label, count }: Props) {
  return (
    <View className="flex-row items-center px-6 mb-3">
      <Text className="text-[10px] font-bold uppercase tracking-widest text-primary">
        {label}
      </Text>
      {count !== undefined && (
        <Text className="text-[10px] text-navy/30 ml-2 font-medium">{count}</Text>
      )}
      <View className="flex-1 h-px bg-navy/5 ml-3" />
    </View>
  );
}