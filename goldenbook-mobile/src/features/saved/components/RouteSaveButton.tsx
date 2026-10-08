import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
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
  const t = useTranslation();

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isPending || !routeId}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? t.a11y.removeFromSaved : t.a11y.save}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
