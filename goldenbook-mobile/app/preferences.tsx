/**
 * Preferences screen
 *
 * Lets the user edit their interests (and optionally their exploration style).
 * Reads from and writes to onboardingStore — the same store that powers the
 * initial onboarding flow and feeds the Discover recommendation engine.
 *
 * Auto-saves on every chip toggle (no explicit save button).
 * Shows a transient "Saved" badge to confirm changes were persisted.
 *
 * Future integration:
 *   When the backend exposes a PATCH /me/preferences endpoint, call it here
 *   alongside the local store update. The data shape is already structured
 *   for that: { interests: string[], explorationStyle: string }.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTranslation } from '@/i18n';
import { colors, typography, spacing, radius } from '@/design/tokens';
import { INTERESTS } from '@/config/interests';

// ─── SavedBadge ───────────────────────────────────────────────────────────────

function SavedBadge({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const t = useTranslation();

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[styles.savedBadge, { opacity }]}>
      <Ionicons name="checkmark" size={11} color={colors.primary} />
      <Text style={styles.savedBadgeText}>{t.preferences.saved}</Text>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PreferencesScreen() {
  const router = useRouter();
  const t      = useTranslation();

  const storedInterests  = useOnboardingStore((s) => s.interests);
  const setInterests     = useOnboardingStore((s) => s.setInterests);

  const [selected, setSelected] = useState<string[]>(storedInterests);
  const [showSaved, setShowSaved] = useState(false);
  const savedKey = useRef(0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((v) => v !== id)
        : [...prev, id];

      // Persist to store immediately on every toggle
      setInterests(next);

      // TODO: When backend is ready, call api.updatePreferences({ interests: next })

      return next;
    });

    // Trigger saved badge (use a key change to re-trigger even on rapid toggles)
    savedKey.current += 1;
    setShowSaved(false);
    setTimeout(() => setShowSaved(true), 0);
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.navy.DEFAULT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t.preferences.title}
          </Text>
        </View>

        {/* Saved badge aligned with back button slot */}
        <View style={styles.headerRight}>
          <SavedBadge visible={showSaved} key={savedKey.current} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero text ── */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t.preferences.subtitle}</Text>
          <Text style={styles.heroBody}>{t.preferences.body}</Text>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Hint ── */}
        <Text style={styles.hint}>{t.preferences.selectHint}</Text>

        {/* ── Chips ── */}
        <View style={styles.chipsGrid}>
          {INTERESTS.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={isSelected ? colors.navy.DEFAULT : `${colors.navy.DEFAULT}50`}
                />
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {t.onboarding[item.labelKey]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Count ── */}
        <Text style={styles.count}>
          {selected.length} {selected.length === 1 ? t.preferences.selectedSingular : t.preferences.selectedPlural}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory.DEFAULT,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.navy.DEFAULT}0D`,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.body,
    fontFamily: typography.sansSemibold,
    color: colors.navy.DEFAULT,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Saved badge ──
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  savedBadgeText: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: colors.primary,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // ── Hero ──
  hero: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontFamily: typography.serifBold,
    fontSize: typography.title,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.tight,
    marginBottom: spacing.sm,
    lineHeight: 30,
  },
  heroBody: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}65`,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // ── Divider ──
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${colors.navy.DEFAULT}12`,
    marginBottom: spacing.lg,
  },

  // ── Hint ──
  hint: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: `${colors.navy.DEFAULT}40`,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.base,
    paddingHorizontal: 2,
  },

  // ── Chips ──
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.base,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}18`,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: typography.sansMedium,
    color: `${colors.navy.DEFAULT}60`,
    letterSpacing: 0.1,
  },
  chipLabelSelected: {
    fontFamily: typography.sansSemibold,
    color: colors.navy.DEFAULT,
  },

  // ── Count ──
  count: {
    fontSize: typography.caption,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}30`,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
