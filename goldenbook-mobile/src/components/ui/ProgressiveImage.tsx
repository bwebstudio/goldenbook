import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  Image,
  ImageResizeMode,
  View,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressiveImageProps {
  /** Image URI to load */
  uri: string | null | undefined;
  /**
   * Aspect ratio expressed as width / height.
   * e.g. 1 = square, 16/9 = landscape, 2/3 = portrait card
   * Ignored when explicit height is provided.
   */
  aspectRatio?: number;
  /** Fixed height. Overrides aspectRatio. */
  height?: number;
  resizeMode?: ImageResizeMode;
  /** Placeholder color shown while loading. Defaults to navy/5 shimmer. */
  placeholderColor?: string;
  /** Corner radius */
  borderRadius?: number;
  /** Extra style on the container View */
  style?: StyleProp<ViewStyle>;
  /** Duration of the fade-in transition in ms (default 300) */
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

  // Fade-in value for the image (0 → 1 on load)
  const imageOpacity = useRef(new Animated.Value(0)).current;

  // Shimmer pulse for the placeholder
  const shimmerAnim = useShimmer();
  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });

  // Reset state when URI changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
    imageOpacity.setValue(0);
  }, [uri, imageOpacity]);

  const handleLoad = () => {
    setLoaded(true);
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: fadeDuration,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setError(true);
    setLoaded(true); // stop shimmer on error
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
        <Animated.Image
          source={{ uri }}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
          style={[StyleSheet.absoluteFill, { opacity: imageOpacity, borderRadius }]}
        />
      )}

      {/* Error fallback: subtle diagonal pattern using overlapping views */}
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
