import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavePlace } from '../hooks/useSavePlace';
import { colors } from '@/design/tokens';
import type { SavedPlaceDTO } from '@/types/api';

interface PlaceSaveButtonProps {
  placeId: string;
  size?: number;
  snapshot?: Partial<SavedPlaceDTO> & { id: string };
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function PlaceSaveButton({
  placeId,
  size = 20,
  snapshot,
  inactiveColor,
  style,
}: PlaceSaveButtonProps) {
  const { isSaved, toggle, isPending } = useSavePlace(placeId, { snapshot });

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isPending || !placeId}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
      style={style}
    >
      <Ionicons
        name={isSaved ? 'heart' : 'heart-outline'}
        size={size}
        color={
          isPending
            ? `${colors.primary}80`
            : isSaved
              ? colors.primary
              : (inactiveColor ?? colors.navy.DEFAULT)
        }
      />
    </TouchableOpacity>
  );
}
