import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MapViewContainer } from '@/features/map/components';
import { colors, typography, spacing, radius, elevation } from '@/design/tokens';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topOffset = insets.top + spacing.sm;

  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const focusCoords =
    lat && lng
      ? { latitude: parseFloat(lat), longitude: parseFloat(lng) }
      : undefined;

  return (
    <View style={styles.container}>
      <MapViewContainer focusCoords={focusCoords} />

      {/* Floating top bar */}
      <View style={[styles.topBar, { top: topOffset }]} pointerEvents="box-none">
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={18} color={colors.navy.DEFAULT} />
        </TouchableOpacity>

        {/* Title pill — centered relative to full width */}
        <View style={styles.titlePill}>
          <Text style={styles.titleText}>Explore</Text>
        </View>

        {/* Spacer to balance the back button */}
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ivory.DEFAULT,
  },
  topBar: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ivory.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  titlePill: {
    backgroundColor: colors.ivory.DEFAULT,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    ...elevation.card,
  },
  titleText: {
    fontSize: typography.caption,
    fontWeight: typography.bold,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.wider,
    textTransform: 'uppercase',
  },
  spacer: {
    width: 40,
  },
});
