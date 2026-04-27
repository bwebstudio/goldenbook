import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  ImageResizeMode,
  View,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressiveImageProps {
  /** Image URI to load */
  uri: string | null | undefined;
  /** Aspect ratio expressed as width / height. Ignored when explicit
   *  height is provided. */
  aspectRatio?: number;
  /** Fixed height. Overrides aspectRatio. */
  height?: number;
  resizeMode?: ImageResizeMode;
  /** Placeholder color shown while loading. */
  placeholderColor?: string;
  /** Corner radius */
  borderRadius?: number;
  /** Extra style on the container View */
  style?: StyleProp<ViewStyle>;
  /** Duration of the fade-in transition in ms (default 300). Mapped to
   *  expo-image's `transition` prop. */
  fadeDuration?: number;
}

// ─── Shimmer animation ────────────────────────────────────────────────────────

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return anim;
}

// ─── Component ───────────────────────────────────────────────────────────────
//
// Backed by `expo-image`, which gives us a real on-disk LRU cache for free.
// Native `Image` only caches in memory + the URL loader's volatile HTTP
// cache, which evicts aggressively and is gone after a relaunch — so the
// same hero image had to be re-downloaded on every cold start. With
// expo-image's `cachePolicy: 'memory-disk'` (the default for static URIs)
// previously seen images render instantly when offline, which is half the
// reason "browse what you already saw" works.

// RN ImageResizeMode → expo-image contentFit mapping. expo-image's vocabulary
// is slightly narrower (`fill` / `none` / `scale-down` instead of `stretch` /
// `center`), so we approximate where there is no exact equivalent.
const RESIZE_MAP: Record<ImageResizeMode, 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
  none: 'none',
  // RN's `repeat` has no expo-image equivalent — fall back to `cover`.
  repeat: 'cover',
};

export function ProgressiveImage({
  uri,
  aspectRatio = 1,
  height,
  resizeMode = 'cover',
  placeholderColor = '#222D52',
  borderRadius = 0,
  style,
  fadeDuration = 300,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const shimmerAnim = useShimmer();
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });

  // Reset state when URI changes.
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [uri]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    setLoaded(true); // stop shimmer
  };

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    height ? { height } : { aspectRatio },
    { borderRadius, overflow: 'hidden' },
    style,
  ];

  return (
    <View style={containerStyle}>
      {/* Shimmer placeholder — visible until image loads */}
      {!loaded && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: placeholderColor,
              opacity: shimmerOpacity,
              borderRadius,
            },
          ]}
        />
      )}

      {/* Static placeholder background */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: placeholderColor, opacity: 0.06, borderRadius },
        ]}
      />

      {/* Actual image — fades in on load */}
      {uri && !error && (
        <ExpoImage
          source={{ uri }}
          contentFit={RESIZE_MAP[resizeMode]}
          onLoad={handleLoad}
          onError={handleError}
          // Disk + memory cache. Lets cold-start renders of previously seen
          // imagery resolve instantly while offline.
          cachePolicy="memory-disk"
          // Recyclable IDs are good for FlatList rows but bad for hero
          // images that want a stable identity — leave default.
          transition={fadeDuration}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}

      {/* Error fallback: subtle diagonal pattern. Also rendered when an
          image is unavailable while offline so the layout doesn't collapse
          to a hole. */}
      {error && (
        <View style={[StyleSheet.absoluteFill, styles.errorFill]}>
          <View style={styles.errorLine} />
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  errorFill: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorLine: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(34,45,82,0.2)',
    transform: [{ rotate: '45deg' }],
  },
});
