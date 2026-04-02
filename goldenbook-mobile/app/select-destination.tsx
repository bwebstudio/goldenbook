// ─── SelectDestinationScreen ──────────────────────────────────────────────────
//
// Full-screen onboarding step shown once after login when the user has not yet
// made an explicit destination choice. Lives at the root Stack level (not inside
// tabs), so it can be navigated to before the tab bar ever appears.
//
// Flow: Auth → /select-destination → /onboarding/interests → /(tabs)
//
// The Continue button only activates after the user taps a destination — the
// default fallback city is NOT treated as an explicit choice.

import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { LocationCard } from '@/components/LocationCard';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SelectDestinationScreen() {
  const availableLocalities       = useAppStore((s) => s.availableLocalities);
  const completeLocalitySelection = useAppStore((s) => s.completeLocalitySelection);
  const router                    = useRouter();

  // No pre-selection — user must make an explicit tap.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const handleSelect = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const handleContinue = useCallback(() => {
    if (!selectedSlug) return;
    completeLocalitySelection(selectedSlug);
    // Replace so the user cannot navigate back to this screen.
    router.replace('/(tabs)');
  }, [selectedSlug, completeLocalitySelection, router]);

  const selectedName = availableLocalities.find((l) => l.slug === selectedSlug)?.name;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Branding ──────────────────────────────────────────────────────── */}
        <View style={styles.brandRow}>
          <Text style={styles.brandStar}>✦</Text>
          <Text style={styles.brandLabel}>GOLDENBOOK GO</Text>
        </View>

        {/* ── Heading ───────────────────────────────────────────────────────── */}
        <Text style={styles.title}>Choose your{'\n'}destination</Text>
        <Text style={styles.subtitle}>
          We'll personalise every recommendation{'\n'}around the city you're exploring.
        </Text>

        {/* ── Gold rule ─────────────────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Location cards ────────────────────────────────────────────────── */}
        <View style={styles.cardList}>
          {availableLocalities.map((locality) => (
            <LocationCard
              key={locality.slug}
              locality={locality}
              selected={locality.slug === selectedSlug}
              onPress={handleSelect}
            />
          ))}
        </View>

        {/* Spacer so the sticky CTA doesn't occlude the last card */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Sticky CTA ────────────────────────────────────────────────────────── */}
      <View style={styles.ctaContainer}>
        {!selectedSlug && (
          <Text style={styles.ctaHint}>Select a destination to continue</Text>
        )}

        <TouchableOpacity
          style={[styles.ctaButton, !selectedSlug && styles.ctaButtonDisabled]}
          onPress={handleContinue}
          disabled={!selectedSlug}
          activeOpacity={0.82}
        >
          <Text style={[styles.ctaText, !selectedSlug && styles.ctaTextDisabled]}>
            {selectedName ? `Continue to ${selectedName}` : 'Choose a destination'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },

  // ── Branding row
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  brandStar: {
    fontSize: 13,
    color: GOLD,
  },
  brandLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 4,
    color: GOLD,
  },

  // ── Heading
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    lineHeight: 40,
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'Inter_300Light',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(34,45,82,0.5)',
    letterSpacing: 0.1,
    marginBottom: 28,
  },

  // ── Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.35)',
    marginBottom: 24,
  },

  // ── Card list
  cardList: {},

  // ── Sticky CTA
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: IVORY,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(210,182,138,0.25)',
    shadowColor: IVORY,
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(34,45,82,0.35)',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  ctaButton: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: 'rgba(34,45,82,0.12)',
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: IVORY,
    letterSpacing: 0.8,
  },
  ctaTextDisabled: {
    color: 'rgba(34,45,82,0.35)',
  },
});
