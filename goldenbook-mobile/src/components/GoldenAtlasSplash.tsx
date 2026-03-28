/**
 * GoldenAtlasSplash
 *
 * Premium animated splash screen telling a discovery story:
 *   ATLAS → ROUTE → DISCOVERY POINT → GOLDENBOOK STAR
 *
 * Colors sourced directly from src/design/tokens.ts and JourneyCompletionView.tsx
 * so the star symbol is pixel-identical to the one used in the route completion screen.
 *
 * Animation timeline (~4.3s total):
 *   0–400ms     Step 1 — Atlas reveal: map grid fades in with subtle scale
 *   400–900ms   Step 2 — Route drawing: gold line grows left → center
 *   900–1300ms  Step 3 — Discovery dot: scales in with overshoot + glow pulse
 *   1300–2100ms Step 4 — Dot → Star: dot fades, ✦ springs in inside gold ring,
 *                         subtle pulse 1 → 1.08 → 1, glow fades
 *   2500–2820ms Step 5 — Title: GOLDENBOOK fades up
 *   2720–3000ms Step 6 — Subtitle fades in, holds for reading
 *   4000–4300ms Step 7 — Exit: screen fades, onComplete fires
 *
 * Pure React Native Animated API — no extra dependencies required.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, typography } from '@/design/tokens';

const { width, height } = Dimensions.get('screen');
const cx = width / 2;
const cy = height / 2;

// ── Design tokens — exact values from src/design/tokens.ts ───────────────────
// colors.navy.DEFAULT  = '#222D52'  (route card background, hero placeholder)
// colors.primary       = '#D2B68A'  (Champagne Gold — star, ring, CTA button)
const BG   = colors.navy.DEFAULT;   // '#222D52'
const GOLD = colors.primary;        // '#D2B68A'

// ── Star ring — matches JourneyCompletionView `goldRing` style exactly ────────
// styles.goldRing: { width:80, height:80, borderRadius:40, borderWidth:1.5, borderColor:'#D2B68A' }
const RING_SIZE        = 80;
const RING_RADIUS      = 40;
const RING_BORDER      = 1.5;

// ── Splash-specific sizes ─────────────────────────────────────────────────────
// Wrapper is slightly larger than the ring so scale animation never clips
const STAR_WRAPPER     = 96;

interface GoldenAtlasSplashProps {
  onComplete: () => void;
}

// Thin static map line — builds the abstract atlas grid
const MapLine = ({ style }: { style: object }) => (
  <View style={[styles.mapLine, style]} />
);

const GoldenAtlasSplash: React.FC<GoldenAtlasSplashProps> = ({ onComplete }) => {
  // ── STEP 1: Atlas map reveal ──────────────────────────────────────────────
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const mapScale   = useRef(new Animated.Value(1.05)).current;

  // ── STEP 2: Route line (non-native driver — animates `width`) ────────────
  const routeWidth   = useRef(new Animated.Value(0)).current;
  const routeOpacity = useRef(new Animated.Value(0)).current;

  // ── STEP 3: Discovery dot ─────────────────────────────────────────────────
  const dotScale       = useRef(new Animated.Value(0)).current;
  const dotGlowOpacity = useRef(new Animated.Value(0)).current;

  // ── STEP 4: Goldenbook star ───────────────────────────────────────────────
  const starScale   = useRef(new Animated.Value(0)).current;
  const starOpacity = useRef(new Animated.Value(0)).current;

  // ── STEP 5 / 6: Title + subtitle ─────────────────────────────────────────
  const textOpacity     = useRef(new Animated.Value(0)).current;
  const textTranslateY  = useRef(new Animated.Value(8)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  // ── STEP 7: Screen exit ───────────────────────────────────────────────────
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // Route target: left margin (20px) → horizontal center
  const ROUTE_TARGET_WIDTH = cx - 20;

  useEffect(() => {
    // STEP 1 — Atlas reveal (0ms) ─────────────────────────────────────────
    Animated.parallel([
      Animated.timing(mapOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(mapScale,   { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // STEP 2 — Route grows left → center (400ms) ──────────────────────────
    // useNativeDriver: false — `width` is not supported by the native driver
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(routeWidth, {
          toValue:         ROUTE_TARGET_WIDTH,
          duration:        500,
          useNativeDriver: false,
        }),
        Animated.timing(routeOpacity, {
          toValue:         1,
          duration:        400,
          useNativeDriver: false,
        }),
      ]).start();
    }, 400);

    // STEP 3 — Discovery dot (900ms) ──────────────────────────────────────
    const t3 = setTimeout(() => {
      Animated.sequence([
        // Overshoot: dot punches in larger than target
        Animated.parallel([
          Animated.timing(dotScale,       { toValue: 1.2,  duration: 150, useNativeDriver: true }),
          Animated.timing(dotGlowOpacity, { toValue: 0.55, duration: 150, useNativeDriver: true }),
        ]),
        // Settle to natural size with glow dimming
        Animated.parallel([
          Animated.timing(dotScale,       { toValue: 1,   duration: 150, useNativeDriver: true }),
          Animated.timing(dotGlowOpacity, { toValue: 0.2, duration: 150, useNativeDriver: true }),
        ]),
      ]).start();
    }, 900);

    // STEP 4 — Dot transforms into the Goldenbook star (1300ms) ───────────
    const t4 = setTimeout(() => {
      // Dot fades out simultaneously with star entrance
      Animated.parallel([
        Animated.timing(dotScale,       { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(dotGlowOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();

      // Star springs in after a brief pause so the transition reads clearly
      setTimeout(() => {
        Animated.parallel([
          // Spring gives the symbol organic energy — matching the route completion reveal
          Animated.spring(starScale, {
            toValue:         1,
            friction:        8,
            tension:         300,
            useNativeDriver: true,
          }),
          Animated.timing(starOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start(() => {
          // Subtle editorial pulse after the spring settles: 1 → 1.08 → 1
          Animated.sequence([
            Animated.timing(starScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
            Animated.timing(starScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
          ]).start();
        });
      }, 90);
    }, 1300);

    // STEP 4b — Route line fades out (1050ms) ────────────────────────────
    // Line finishes at ~1350ms; star ring springs in at 1390ms — no overlap
    const t4b = setTimeout(() => {
      Animated.timing(routeOpacity, {
        toValue:         0,
        duration:        300,
        useNativeDriver: false,
      }).start();
    }, 1050);

    // STEP 5 — Title reveals (2500ms) ─────────────────────────────────────
    const t5 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity,    { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    }, 2500);

    // STEP 6 — Subtitle fades in (2720ms) — once title is established ────
    // Subtitle is fully visible by ~3000ms; exit at 3300ms gives ~300ms read time
    const t6 = setTimeout(() => {
      Animated.timing(subtitleOpacity, { toValue: 0.7, duration: 280, useNativeDriver: true }).start();
    }, 2720);

    // STEP 7 — Exit fade (4000ms) ─────────────────────────────────────────
    // Subtitle fully visible at ~3000ms; 1000ms hold gives comfortable read time
    const t7 = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue:         0,
        duration:        300,
        useNativeDriver: true,
      }).start(() => onComplete());
    }, 4000);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t4b);
      clearTimeout(t5);
      clearTimeout(t6);
      clearTimeout(t7);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>

      {/* ── Layer 1: Navy background ── */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: BG }]} />

      {/* ── Layer 2: Abstract atlas map grid ── */}
      {/*
        Thin white lines at ~18% opacity simulate an editorial atlas texture.
        Slight angles per line give an organic, hand-drawn cartography feel.
        Remains visible as context throughout the full animation.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: mapOpacity, transform: [{ scale: mapScale }] },
        ]}
      >
        {/* Horizontal grid */}
        <MapLine style={{ top: height * 0.12, left: -20, right: -20, transform: [{ rotate: '0.8deg'  }] }} />
        <MapLine style={{ top: height * 0.26, left: -20, right: -20, transform: [{ rotate: '-0.6deg' }] }} />
        <MapLine style={{ top: height * 0.40, left: -20, right: -20, transform: [{ rotate: '0.5deg'  }] }} />
        <MapLine style={{ top: height * 0.54, left: -20, right: -20, transform: [{ rotate: '-0.7deg' }] }} />
        <MapLine style={{ top: height * 0.67, left: -20, right: -20, transform: [{ rotate: '0.4deg'  }] }} />
        <MapLine style={{ top: height * 0.82, left: -20, right: -20, transform: [{ rotate: '-0.5deg' }] }} />

        {/* Vertical grid */}
        <MapLine style={{ left: width * 0.12, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '0.6deg'  }] }} />
        <MapLine style={{ left: width * 0.26, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '-0.4deg' }] }} />
        <MapLine style={{ left: width * 0.44, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '0.5deg'  }] }} />
        <MapLine style={{ left: width * 0.61, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '-0.6deg' }] }} />
        <MapLine style={{ left: width * 0.77, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '0.4deg'  }] }} />
        <MapLine style={{ left: width * 0.91, top: -20, bottom: -20, width: StyleSheet.hairlineWidth, height: undefined, transform: [{ rotate: '-0.5deg' }] }} />

        {/* Diagonal accents — suggest travel paths */}
        <MapLine style={{ top: height * 0.42, left: -20,           width: width * 0.50, transform: [{ rotate: '28deg'  }], opacity: 0.5 }} />
        <MapLine style={{ top: height * 0.18, left: width * 0.50, width: width * 0.65, transform: [{ rotate: '38deg'  }], opacity: 0.5 }} />
        <MapLine style={{ top: height * 0.60, left: width * 0.10, width: width * 0.70, transform: [{ rotate: '-22deg' }], opacity: 0.5 }} />

        {/* City block outlines */}
        <View style={[styles.cityBlock, { top: height * 0.15, left: width * 0.13, width: width * 0.12, height: height * 0.08 }]} />
        <View style={[styles.cityBlock, { top: height * 0.69, left: width * 0.59, width: width * 0.18, height: height * 0.10 }]} />
      </Animated.View>

      {/* ── Layer 3: Animated gold route line ── */}
      {/*
        Width animates from 0 to cx–20 over 500ms — cannot use native driver.
        Terminates exactly at the horizontal center where the dot will appear.
      */}
      <Animated.View
        pointerEvents="none"
        style={[styles.routeLine, { top: cy - 0.75, left: 20, width: routeWidth, opacity: routeOpacity }]}
      />

      {/* ── Layer 4: Discovery dot + diffuse glow ── */}
      {/*
        Anchored at screen center (cx, cy) — the terminus of the route.
        Scales in with an overshoot before settling, matching the energy
        of the spring that follows in the star reveal.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.dotWrapper,
          { top: cy - 24, left: cx - 24, transform: [{ scale: dotScale }] },
        ]}
      >
        <Animated.View style={[styles.dotGlow, { opacity: dotGlowOpacity }]} />
        <View style={styles.dot} />
      </Animated.View>

      {/* ── Layer 5: Goldenbook star inside gold ring ── */}
      {/*
        Dimensions and stroke are IDENTICAL to JourneyCompletionView `goldRing`:
          width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: '#D2B68A'
          ✦  fontSize: 28, color: '#D2B68A'

        The wrapper (STAR_WRAPPER = 96px) is larger than the ring so the scale
        spring can breathe beyond the ring boundary without clipping.
        The ring itself is centered inside the wrapper via alignItems/justifyContent.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.starWrapper,
          {
            top:     cy - STAR_WRAPPER / 2,
            left:    cx - STAR_WRAPPER / 2,
            opacity: starOpacity,
            transform: [{ scale: starScale }],
          },
        ]}
      >
        {/* Gold ring — pixel-identical to goldRing in JourneyCompletionView */}
        <View style={styles.goldRing}>
          <Text style={styles.starText}>✦</Text>
        </View>
      </Animated.View>

      {/* ── Layer 6: GOLDENBOOK title + editorial subtitle ── */}
      {/*
        Positioned below the star ring with enough clearance so they never overlap
        even during the scale pulse. translateY animation brings text up from +8px.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.textWrapper,
          {
            top:     cy + STAR_WRAPPER / 2 + 24,
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={styles.brandTitle}>GOLDENBOOK</Text>
        <Animated.Text style={[styles.brandSubtitle, { opacity: subtitleOpacity }]}>
          Curated places. Exceptional experiences.
        </Animated.Text>
      </Animated.View>

    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  // Atlas grid
  mapLine: {
    position:        'absolute',
    height:          StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cityBlock: {
    position:        'absolute',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     'rgba(255,255,255,0.12)',
    backgroundColor: 'transparent',
  },

  // Route line
  routeLine: {
    position:        'absolute',
    height:          1.5,
    backgroundColor: GOLD,
    borderRadius:    1,
  },

  // Dot
  dotWrapper: {
    position:        'absolute',
    width:           48,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dotGlow: {
    position:        'absolute',
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: GOLD,
  },
  dot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: GOLD,
  },

  // Star — wrapper gives scale room; ring matches JourneyCompletionView exactly
  starWrapper: {
    position:       'absolute',
    width:          STAR_WRAPPER,
    height:         STAR_WRAPPER,
    alignItems:     'center',
    justifyContent: 'center',
  },
  goldRing: {
    width:          RING_SIZE,
    height:         RING_SIZE,
    borderRadius:   RING_RADIUS,
    borderWidth:    RING_BORDER,
    borderColor:    GOLD,
    alignItems:     'center',
    justifyContent: 'center',
  },
  starText: {
    fontSize:   28,
    color:      GOLD,
    lineHeight: 32,
  },

  // Text
  textWrapper: {
    position:   'absolute',
    left:       0,
    right:      0,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize:    22,
    letterSpacing: typography.wider, // 3 — matches token scale
    color:       'rgba(253,253,251,0.92)', // colors.ivory.DEFAULT at 92%
    fontFamily:  typography.serifBold,    // 'PlayfairDisplay_700Bold'
  },
  brandSubtitle: {
    marginTop:     8,
    fontSize:      typography.caption,   // 12
    letterSpacing: typography.wide,      // 1.5
    color:         'rgba(253,253,251,0.55)',
    fontFamily:    typography.sansLight, // 'Inter_300Light'
  },
});

export default GoldenAtlasSplash;
