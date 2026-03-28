// ─── LocalitySwitcher ─────────────────────────────────────────────────────────
//
// Premium bottom-sheet style modal for switching the active locality.
// Uses React Native's built-in Modal — no extra dependencies.
//
// Usage:
//   <LocalitySwitcher visible={open} onClose={() => setOpen(false)} />

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '@/store/appStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Locality } from '@/config/localities';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// ─── Accent colours per locality — no image required ─────────────────────────
const LOCALITY_ACCENT: Record<string, string> = {
  lisboa:  '#C4A882',
  porto:   '#8B6F5E',
  algarve: '#C9A96E',
  madeira: '#7D9F85',
};

// ─── Single locality row ──────────────────────────────────────────────────────

interface LocalityRowProps {
  locality: Locality;
  isSelected: boolean;
  onPress: (slug: string) => void;
}

function LocalityRow({ locality, isSelected, onPress }: LocalityRowProps) {
  const accent  = LOCALITY_ACCENT[locality.slug] ?? GOLD;
  const locale  = useSettingsStore((s) => s.locale);
  const tagline = locality.tagline[locale] ?? locality.tagline.en;

  return (
    <TouchableOpacity
      onPress={() => onPress(locality.slug)}
      activeOpacity={0.82}
      style={[styles.row, isSelected && styles.rowSelected]}
    >
      {/* Colour swatch */}
      <View style={[styles.swatch, { backgroundColor: accent }]}>
        <Text style={styles.swatchInitial}>
          {locality.name.charAt(0)}
        </Text>
      </View>

      {/* Text */}
      <View style={styles.rowText}>
        <Text style={[styles.localityName, isSelected && styles.localityNameSelected]}>
          {locality.name}
        </Text>
        <Text style={styles.tagline} numberOfLines={1}>
          {tagline}
        </Text>
      </View>

      {/* Selected indicator */}
      {isSelected && (
        <View style={styles.checkCircle}>
          <Text style={styles.checkMark}>✦</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Switcher modal ───────────────────────────────────────────────────────────

interface LocalitySwitcherProps {
  visible: boolean;
  onClose: () => void;
}

export function LocalitySwitcher({ visible, onClose }: LocalitySwitcherProps) {
  const selectedCity       = useAppStore((s) => s.selectedCity);
  const availableLocalities = useAppStore((s) => s.availableLocalities);
  const setCity            = useAppStore((s) => s.setCity);

  // Slide-up animation
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleSelect = useCallback(
    (slug: string) => {
      setCity(slug);
      onClose();
    },
    [setCity, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}
      >
        <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetLabel}>GOLDENBOOK</Text>
            <Text style={styles.sheetTitle}>Choose your destination</Text>
            <View style={styles.divider} />
          </View>

          {/* Locality list */}
          <View style={styles.list}>
            {availableLocalities.map((locality) => (
              <LocalityRow
                key={locality.slug}
                locality={locality}
                isSelected={locality.slug === selectedCity}
                onPress={handleSelect}
              />
            ))}
          </View>

          {/* Close */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeBtnText}>Cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Modal overlay ────────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,45,82,0.45)',
  },

  // ── Sheet ─────────────────────────────────────────────────────────────────────
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: IVORY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 16,
  },
  sheetInner: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  // ── Handle ────────────────────────────────────────────────────────────────────
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(34,45,82,0.12)',
    alignSelf: 'center',
    marginBottom: 20,
  },

  // ── Sheet header ──────────────────────────────────────────────────────────────
  sheetHeader: {
    marginBottom: 8,
  },
  sheetLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 4,
    color: GOLD,
    marginBottom: 6,
  },
  sheetTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: NAVY,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.3)',
    marginBottom: 8,
  },

  // ── List ──────────────────────────────────────────────────────────────────────
  list: {
    gap: 4,
    marginBottom: 16,
  },

  // ── Row ───────────────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 14,
    backgroundColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: 'rgba(210,182,138,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.35)',
  },

  // Colour swatch / initial avatar
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  swatchInitial: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
  },

  rowText: {
    flex: 1,
  },
  localityName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: NAVY,
    letterSpacing: -0.1,
  },
  localityNameSelected: {
    color: NAVY,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(34,45,82,0.45)',
    marginTop: 2,
    letterSpacing: 0.1,
  },

  // Selected checkmark
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkMark: {
    fontSize: 10,
    color: GOLD,
  },

  // ── Cancel button ─────────────────────────────────────────────────────────────
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(34,45,82,0.05)',
  },
  closeBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: 'rgba(34,45,82,0.5)',
    letterSpacing: 0.2,
  },
});
