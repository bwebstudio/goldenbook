import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSaveRoute } from '../hooks/useSaveRoute';
import { colors } from '@/design/tokens';
import type { SavedRouteDTO } from '@/types/api';

interface RouteSaveButtonProps {
  routeId: string;
  size?: number;
  /** Snapshot used for optimistic save (so the saved list shows it instantly). */
  snapshot?: Partial<SavedRouteDTO> & { id: string };
  /** Tint when not saved (defaults to navy). Use white over hero images. */
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Heart toggle for route cards & detail screens. Mirrors PlaceSaveButton.
 */
export function RouteSaveButton({
  routeId,
  size = 20,
  snapshot,
  inactiveColor,
  style,
}: RouteSaveButtonProps) {
  const { isSaved, toggle, isPending } = useSaveRoute(routeId, { snapshot });

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isPending || !routeId}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
