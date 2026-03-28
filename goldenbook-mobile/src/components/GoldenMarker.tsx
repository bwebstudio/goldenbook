/**
 * GoldenMarker
 *
 * The Goldenbook discovery symbol: thin circle + ✦ star.
 * Single reusable component for the full icon system —
 * map markers, route cards, Golden Picks, and the splash screen
 * all share this same visual language.
 *
 * Variants:
 *   default  — thin gold ring, gold star            (standard place)
 *   visited  — filled gold ring, white star          (place already visited)
 *   featured — gold ring, gold star, pulsing glow    (Golden Pick / recommended)
 *   route    — gold ring, gold star, pointer below   (waypoint on a Golden Route)
 *
 * Usage:
 *   <GoldenMarker />                           // default, 40px
 *   <GoldenMarker variant="visited" />
 *   <GoldenMarker variant="featured" size={48} />
 *   <GoldenMarker variant="route" size={36} />
 *
 * Size notes:
 *   The default size (40px) is tuned for map pins and card icons.
 *   Pass size={80} to match the splash screen symbol exactly —
 *   borderWidth 1.5 and fontSize 28 align with JourneyCompletionView.goldRing.
 *
 * Colors sourced from src/design/tokens.ts — no new hex values.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/design/tokens';

// ── Palette ────────────────────────────────────────────────────────────────────
const GOLD  = colors.primary;        // '#D2B68A' — ring, star, pointer
const NAVY  = colors.navy.DEFAULT;   // '#222D52' — visited ring fill background
const WHITE = colors.ivory.DEFAULT;  // '#FDFDFB' — star on filled (visited) ring

// ── Types ──────────────────────────────────────────────────────────────────────
export type GoldenMarkerVariant = 'default' | 'visited' | 'featured' | 'route';

export interface GoldenMarkerProps {
  /** Visual variant — controls fill, glow, and pointer */
  variant?: GoldenMarkerVariant;
  /**
   * Diameter of the ring in dp.
   * All internal dimensions scale proportionally.
   * Default: 40 (map / card use). Use 80 to match the splash screen.
   */
  size?: number;
  /** Additional style applied to the outermost wrapper */
  style?: ViewStyle;
}

// ── Component ──────────────────────────────────────────────────────────────────
const GoldenMarker: React.FC<GoldenMarkerProps> = ({
  variant = 'default',
  size = 40,
  style,
}) => {
  const isFeatured = variant === 'featured';
  const isVisited  = variant === 'visited';
  const isRoute    = variant === 'route';

  // ── Derived sizes ─────────────────────────────────────────────────────────
  // Border scales with size but is clamped so small markers stay crisp
  const borderWidth = size >= 64 ? 1.5 : 1;
  // Star character fills ~35% of the ring diameter, matching JourneyCompletionView
  const starFontSize = Math.max(10, Math.round(size * 0.35));
  // Glow halo is 1.7× the ring for a soft, contained bloom
  const glowSize = size * 1.7;
  // Pointer triangle dimensions (route variant)
  const pointerW = Math.round(size * 0.36);  // total base width
  const pointerH = Math.round(size * 0.22);  // height of triangle

  // ── Glow animation (featured only) ───────────────────────────────────────
  // Slow breathing loop: opacity pulses 0.12 → 0.35 every 1.6s each way.
  // Uses native driver — no JS thread involvement after mount.
  const glowOpacity = useRef(new Animated.Value(0.12)).current;

  useEffect(() => {
    if (!isFeatured) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue:         0.35,
          duration:        1600,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue:         0.12,
          duration:        1600,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isFeatured]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.wrapper, style]}>

      {/* ── Glow halo (featured only) ── */}
      {/*
        Positioned absolutely so it doesn't affect layout.
        Centred behind the ring by applying a negative margin
        equal to half the difference between glow and ring size.
      */}
      {isFeatured && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            {
              width:        glowSize,
              height:       glowSize,
              borderRadius: glowSize / 2,
              // Pull the glow up/left so it is centred on the ring
              top:  -(glowSize - size) / 2,
              left: -(glowSize - size) / 2,
              opacity: glowOpacity,
            },
          ]}
        />
      )}

      {/* ── Ring + star ── */}
      <View
        style={[
          styles.ring,
          {
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            borderWidth:     borderWidth,
            borderColor:     GOLD,
            // visited: filled; all others: transparent (navy bg shows through)
            backgroundColor: isVisited ? GOLD : 'transparent',
          },
        ]}
      >
        <Text
          style={[
            styles.star,
            {
              fontSize:   starFontSize,
              lineHeight: starFontSize * 1.2,
              // visited: white star on gold fill; all others: gold star
              color: isVisited ? NAVY : GOLD,
            },
          ]}
        >
          ✦
        </Text>
      </View>

      {/* ── Route pointer triangle ── */}
      {/*
        Classic border-trick triangle: zero-size box with coloured top border
        and transparent side borders creates a downward-pointing arrow.
        Sits flush below the ring without gap, visually anchoring the
        marker to the route path on the map.
      */}
      {isRoute && (
        <View
          style={[
            styles.pointer,
            {
              borderLeftWidth:   pointerW / 2,
              borderRightWidth:  pointerW / 2,
              borderTopWidth:    pointerH,
              borderTopColor:    GOLD,
            },
          ]}
        />
      )}

    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Outer wrapper — column, centred, overflow visible so glow halo can bleed out
  wrapper: {
    alignItems:    'center',
    // No explicit size — wrapper hugs its content
  },

  // Circular ring — variant-specific fill/border set inline above
  ring: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ✦ star character — color set inline above
  star: {
    includeFontPadding: false, // Android: remove extra ascender space
    textAlignVertical:  'center',
  },

  // Gold glow halo (featured) — absolute so it doesn't push layout
  glow: {
    position:        'absolute',
    backgroundColor: GOLD,
  },

  // Route pointer — zero-size border triangle
  pointer: {
    width:             0,
    height:            0,
    borderLeftColor:   'transparent',
    borderRightColor:  'transparent',
    // borderTopColor and widths set inline above
    marginTop:         -1, // close the 1px gap between ring border and pointer tip
  },
});

export default GoldenMarker;
