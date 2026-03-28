import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavePlace } from '../hooks/useSavePlace';
import { colors } from '@/design/tokens';

interface PlaceSaveButtonProps {
  placeId: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared bookmark toggle for place cards.
 * bookmark-outline = not saved, bookmark (filled) = saved.
 * Uses useSavePlace internally — no external state needed.
 */
export function PlaceSaveButton({ placeId, size = 20, style }: PlaceSaveButtonProps) {
  const { isSaved, toggle, isPending } = useSavePlace(placeId);

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isPending}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={style}
    >
      <Ionicons
        name={isSaved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={isPending ? `${colors.primary}60` : isSaved ? colors.primary : colors.navy.DEFAULT}
      />
    </TouchableOpacity>
  );
}
