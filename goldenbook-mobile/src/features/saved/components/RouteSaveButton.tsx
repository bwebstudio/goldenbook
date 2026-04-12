import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSaveRoute } from '../hooks/useSaveRoute';
import { colors } from '@/design/tokens';
import type { SavedRouteDTO } from '@/types/api';

interface RouteSaveButtonProps {
  routeId: string;
  size?: number;
  snapshot?: Partial<SavedRouteDTO> & { id: string };
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
}

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
