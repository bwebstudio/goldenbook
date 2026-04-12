import { Pressable, StyleProp, ViewStyle } from 'react-native';
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
 * See PlaceSaveButton for documentation on Pressable / hitSlop / responder.
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
    <Pressable
      onPress={toggle}
      disabled={isPending || !routeId}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.5 : isPending ? 0.6 : 1,
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
