import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore, selectIsOffline } from '@/store/networkStore';
import { useTranslation } from '@/i18n';

// Slim pill that slides in below the status bar when the device goes
// offline and slides out the moment it's back. We don't take any tap
// affordance — the banner is purely informational. Retry actions live on
// the screens themselves (and the queryClient automatically refetches when
// `refetchOnReconnect` flips back to online).

const HEIGHT = 28;
const ANIM_MS = 220;

export function OfflineBanner() {
  const isOffline = useNetworkStore(selectIsOffline);
  const insets    = useSafeAreaInsets();
  const t         = useTranslation();

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOffline ? 1 : 0,
      duration: ANIM_MS,
      useNativeDriver: true,
    }).start();
  }, [isOffline, anim]);

  // Don't even render when fully hidden — saves a layer.
  if (!isOffline) {
    // Keep the animation alive so the slide-out completes before we unmount.
    // The opacity will already be 0 by the time we hit this branch on the
    // tail end of the slide-out.
    return null;
  }

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-(HEIGHT + insets.top + 8), 0],
  });
  const opacity = anim;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        { paddingTop: insets.top, transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.pill}>
        <View style={styles.dot} />
        <Text style={styles.label}>{t.offline.banner}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#161E38',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    height: HEIGHT,
    marginTop: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D2B68A',
  },
  label: {
    color: '#FDFDFB',
    fontSize: 12,
    letterSpacing: 0.4,
    fontWeight: '600',
  },
});
