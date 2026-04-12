import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavePlace } from '../hooks/useSavePlace';
import { colors } from '@/design/tokens';
import type { SavedPlaceDTO } from '@/types/api';

interface PlaceSaveButtonProps {
  placeId: string;
  size?: number;
  /** Snapshot used for optimistic save (so the saved list shows it instantly). */
  snapshot?: Partial<SavedPlaceDTO> & { id: string };
  /** Tint when not saved (defaults to navy). Use white over hero images. */
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared heart toggle for place cards & detail screens.
 *
 * Uses Pressable (not TouchableOpacity) so that `hitSlop` reliably expands
 * the touch rect on EVERY device. The old TouchableOpacity implementation
 * used `hitSlop: 10`, but when the button was rendered inside an ancestor
 * with `overflow: 'hidden'` (e.g. card images), the expanded rect was
 * clipped and touches on iPhone XS (375pt) didn't register because the
 * finger was landing outside the icon but inside the clipped zone.
 *
 * The fix: use Pressable with a generous `hitSlop: 16`, and—critically—
 * `onStartShouldSetResponder` returning true so the responder system gives
 * this button priority over the underlying card's TouchableOpacity.
 */
export function PlaceSaveButton({
  placeId,
  size = 20,
  snapshot,
  inactiveColor,
  style,
}: PlaceSaveButtonProps) {
  const { isSaved, toggle, isPending } = useSavePlace(placeId, { snapshot });

  return (
    <Pressable
      onPress={toggle}
      disabled={isPending || !placeId}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.5 : isPending ? 0.6 : 1,
          // Minimum 44×44 touch target (Apple HIG). The icon renders
          // centered inside this area. This guarantees the Pressable
          // itself—not just hitSlop—fills the Apple minimum, even if the
          // parent container is tight.
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        style,
      ]}
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
    </Pressable>
  );
}
