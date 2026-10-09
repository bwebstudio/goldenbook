import { TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@/i18n';
import { useSavePlace } from '../hooks/useSavePlace';
import { colors } from '@/design/tokens';
import type { SavedPlaceDTO } from '@/types/api';
import type { PlaceSource } from '@/analytics/track';

interface PlaceSaveButtonProps {
  placeId: string;
  size?: number;
  snapshot?: Partial<SavedPlaceDTO> & { id: string };
  inactiveColor?: string;
  style?: StyleProp<ViewStyle>;
  /** Surface the button lives on, sent with favorite_add / remove. */
  source?: PlaceSource;
  /** Primary category slug of the place, when the card knows it. */
  category?: string | null;
}

export function PlaceSaveButton({
  placeId,
  size = 20,
  snapshot,
  inactiveColor,
  style,
  source,
  category,
}: PlaceSaveButtonProps) {
  const { isSaved, toggle, isPending } = useSavePlace(placeId, { snapshot, source, category });
  const t = useTranslation();

  return (
    <TouchableOpacity
      onPress={toggle}
      disabled={isPending || !placeId}
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
