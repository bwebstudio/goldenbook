/**
 * Onboarding Screen 2 — "How do you usually explore?"
 *
 * Single-select exploration style cards.
 * Navy background, gold accent, consistent with interests screen.
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
import { useOnboardingStore, ExplorationStyle } from '@/store/onboardingStore';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const STYLES: { id: ExplorationStyle; icon: IoniconName; title: string; subtitle: string }[] = [
  {
    id: 'solo',
    icon: 'person-outline',
    title: 'Solo',
    subtitle: 'Just me, my pace',
  },
  {
    id: 'couple',
    icon: 'heart-outline',
    title: 'Couple',
    subtitle: 'Romantic escape',
  },
  {
    id: 'friends',
    icon: 'people-outline',
    title: 'Friends',
    subtitle: 'Group adventure',
  },
  {
    id: 'family',
    icon: 'home-outline',
    title: 'Family',
    subtitle: 'With the family',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExplorationStyleScreen() {
  const router              = useRouter();
  const interestsFromStore  = useOnboardingStore((s) => s.interests);
  const completeOnboarding  = useOnboardingStore((s) => s.completeOnboarding);

  const [selected, setSelected] = useState<ExplorationStyle | null>(null);

  const handleDone = () => {
    if (!selected) return;
    completeOnboarding(interestsFromStore, selected);
    router.replace('/(tabs)' as any);
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
          <Text style={styles.heading}>How do you{'\n'}usually explore?</Text>
          <Text style={styles.subheading}>
            We'll tailor your experience accordingly.
          </Text>
        </View>

        {/* ── Style cards ─────────────────────────────────────────────── */}
        <View style={styles.cardsGrid}>
          {STYLES.map((item) => {
            const isSelected = selected === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(item.id)}
                activeOpacity={0.78}
              >
                <Ionicons
                  name={item.icon}
                  size={28}
                  color={isSelected ? GOLD : 'rgba(253,253,251,0.55)'}
                  style={styles.cardIcon}
                />
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, isSelected && styles.cardSubtitleSelected]}>
                  {item.subtitle}
                </Text>
                {isSelected && <View style={styles.cardCheckDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={handleDone}
          disabled={!selected}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>Enter Goldenbook Go</Text>
        </TouchableOpacity>

        {/* ── Step indicator ──────────────────────────────────────────── */}
        <View style={styles.stepRow}>
          <View style={styles.stepDot} />
          <View style={[styles.stepDot, styles.stepDotActive]} />
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

  // Cards — 2x2 grid
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  card: {
    width: '47.5%',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(210,182,138,0.20)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: 'rgba(210,182,138,0.12)',
    borderColor: GOLD,
  },
  cardIcon: {
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: IVORY,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  cardTitleSelected: {
    color: GOLD,
  },
  cardSubtitle: {
    fontFamily: 'Inter_300Light',
    fontSize: 11,
    color: 'rgba(253,253,251,0.40)',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardSubtitleSelected: {
    color: 'rgba(210,182,138,0.70)',
  },
  cardCheckDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLD,
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
    marginBottom: 24,
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
