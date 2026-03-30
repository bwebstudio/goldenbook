/**
 * LocationCard — editorial full-width image card for destination selection.
 *
 * Resolves its own image from Supabase Storage (public bucket: "locations").
 * Scale-animates on selection with a gold border + check badge.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@/store/settingsStore';
import type { Locality } from '@/config/localities';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// ─── Image URL helper ─────────────────────────────────────────────────────────
// Supabase public storage: <project_url>/storage/v1/object/public/<bucket>/<file>

const STORAGE_BASE =
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public`;

export function getLocationImage(slug: string): string {
  return `${STORAGE_BASE}/locations/${slug}.jpg`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LocationCardProps {
  locality: Locality;
  selected: boolean;
  onPress: (slug: string) => void;
}

export function LocationCard({ locality, selected, onPress }: LocationCardProps) {
  const scale   = useRef(new Animated.Value(1)).current;
  const locale  = useSettingsStore((s) => s.locale);
  const tagline = locality.tagline[locale] ?? locality.tagline.en;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.02 : 1,
      useNativeDriver: true,
      tension: 140,
      friction: 8,
    }).start();
  }, [selected, scale]);

  return (
    <TouchableOpacity
      onPress={() => onPress(locality.slug)}
      activeOpacity={0.93}
      style={styles.touchable}
    >
      <Animated.View
        style={[
          styles.card,
          selected && styles.cardSelected,
          { transform: [{ scale }] },
        ]}
      >
        <ImageBackground
          source={{ uri: getLocationImage(locality.slug) }}
          style={styles.image}
          imageStyle={styles.imageInner}
          resizeMode="cover"
        >
          {/* ── Dark base overlay for contrast ────────────────────────── */}
          <View
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' }}
            pointerEvents="none"
          />

          {/* ── Goldenbook blue gradient scrim ────────────────────────── */}
          <LinearGradient
            colors={['transparent', 'rgba(17,35,67,0.55)']}
            locations={[0.35, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* ── Selected badge — top right ─────────────────────────────── */}
          {selected && (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={11} color={NAVY} />
            </View>
          )}

          {/* ── Text — bottom left ─────────────────────────────────────── */}
          <View style={styles.textBlock}>
            <Text style={styles.country}>
              {locality.country.toUpperCase()}
            </Text>
            <Text style={styles.name}>{locality.name}</Text>
            <Text style={styles.tagline} numberOfLines={1}>
              {tagline}
            </Text>
          </View>
        </ImageBackground>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 16,
  },

  card: {
    height: 185,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    // Ambient shadow
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 3,
  },
  cardSelected: {
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 7,
  },

  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // borderRadius on imageStyle ensures rounded corners on Android
  imageInner: {
    borderRadius: 18,
  },

  // Check badge
  checkBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text content
  textBlock: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  country: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 3.5,
    color: 'rgba(253,253,251,0.55)',
    marginBottom: 3,
  },
  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: IVORY,
    letterSpacing: -0.3,
    marginBottom: 5,
  },
  tagline: {
    fontFamily: 'Inter_300Light',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(253,253,251,0.52)',
    letterSpacing: 0.1,
  },
});
