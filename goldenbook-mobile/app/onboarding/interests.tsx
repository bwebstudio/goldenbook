/**
 * Onboarding Screen 1 — "What would you love to discover?"
 *
 * Interest chip multi-select. Min 2, max 5 selections.
 * Navy background, gold accent, consistent with auth entry.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useTranslation } from '@/i18n';
import { ONBOARDING_INTERESTS } from '@/config/interests';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// Curated subset shared with Preferences — see src/config/interests.ts
const INTEREST_KEYS = ONBOARDING_INTERESTS;

const MIN_SELECTIONS = 2;
const MAX_SELECTIONS = 5;

// ─── Component ────────────────────────────────────────────────────────────────

export default function InterestsScreen() {
  const router        = useRouter();
  const t             = useTranslation();
  const setInterests  = useOnboardingStore((s) => s.setInterests);

  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, id];
    });
  };

  const canContinue = selected.length >= MIN_SELECTIONS;

  const handleNext = () => {
    if (!canContinue) return;
    setInterests(selected);
    router.push('/onboarding/style');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.ornamentRow}>
            <View style={styles.ornamentLine} />
            <Text style={styles.ornamentStar}>✦</Text>
            <View style={styles.ornamentLine} />
          </View>
          <Text style={styles.wordmark}>GOLDENBOOK GO</Text>
          <View style={styles.accentRule} />
          <Text style={styles.heading}>{t.onboarding.interestsHeading}</Text>
          <Text style={styles.subheading}>
            {t.onboarding.interestsSubheading}
          </Text>
        </View>

        {/* ── Chips ───────────────────────────────────────────────────── */}
        <View style={styles.chipsGrid}>
          {INTEREST_KEYS.map((item) => {
            const isSelected = selected.includes(item.id);
            const isDisabled = !isSelected && selected.length >= MAX_SELECTIONS;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                  isDisabled && styles.chipDisabled,
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={isSelected ? NAVY : 'rgba(253,253,251,0.75)'}
                />
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {t.onboarding[item.labelKey]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Counter hint ────────────────────────────────────────────── */}
        <Text style={styles.hint}>
          {selected.length} / {MAX_SELECTIONS} {t.onboarding.selected}
        </Text>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btn, !canContinue && styles.btnDisabled]}
          onPress={handleNext}
          disabled={!canContinue}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>{t.onboarding.continue}</Text>
        </TouchableOpacity>

        {/* ── Step indicator ──────────────────────────────────────────── */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={styles.stepDot} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 32,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 18,
  },
  ornamentLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.28)',
  },
  ornamentStar: {
    fontSize: 11,
    color: GOLD,
  },
  wordmark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 5,
    color: GOLD,
    marginBottom: 20,
  },
  accentRule: {
    width: 36,
    height: 1.5,
    backgroundColor: GOLD,
    borderRadius: 1,
    marginBottom: 24,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 37,
    color: IVORY,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subheading: {
    fontFamily: 'Inter_300Light',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(253,253,251,0.46)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // Chips
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(210,182,138,0.25)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipSelected: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipDisabled: {
    opacity: 0.35,
  },
  chipLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: 'rgba(253,253,251,0.75)',
    letterSpacing: 0.1,
  },
  chipLabelSelected: {
    color: NAVY,
    fontFamily: 'Inter_600SemiBold',
  },

  // Counter
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(253,253,251,0.28)',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 28,
  },

  // CTA
  btn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: 'rgba(210,182,138,0.25)',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: NAVY,
    letterSpacing: 0.3,
  },

  // Step dots
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(210,182,138,0.25)',
  },
  stepDotActive: {
    backgroundColor: GOLD,
    width: 18,
    borderRadius: 3,
  },
});
