/**
 * Auth Entry Screen — front door of Goldenbook Go.
 *
 * Deep navy canvas. Brand identity up top, auth options below.
 * Social auth (Google, Apple) are first-class options here alongside
 * the email-based paths.
 *
 * Layout:
 *   Brand zone — ornament / wordmark / headline / subtitle
 *   CTA zone   — Sign in / Create account / divider / Google / Apple / legal
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGoogleSignIn, useAppleSignIn } from '@/hooks/useSocialAuth';

const { height: H } = Dimensions.get('window');

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthEntryScreen() {
  const router = useRouter();

  const { signIn: googleSignIn, loading: googleLoading, error: googleError } = useGoogleSignIn();
  const { signIn: appleSignIn,  loading: appleLoading,  error: appleError  } = useAppleSignIn();

  const isBusy      = googleLoading || appleLoading;
  const socialError = googleError || appleError;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Brand zone ──────────────────────────────────────────────── */}
        <View style={styles.brandZone}>

          {/* Ornament row */}
          <View style={styles.ornamentRow}>
            <View style={styles.ornamentLine} />
            <Text style={styles.ornamentStar}>✦</Text>
            <View style={styles.ornamentLine} />
          </View>

          {/* Wordmark */}
          <Text style={styles.wordmark}>GOLDENBOOK GO</Text>

          {/* Gold accent rule */}
          <View style={styles.accentRule} />

          {/* Headline */}
          <Text style={styles.headline}>
            Discover Portugal's{'\n'}finest places.
          </Text>

          {/* Subheadline */}
          <Text style={styles.subheadline}>
            Curated restaurants, hotels and experiences{'\n'}handpicked across Portugal.
          </Text>
        </View>

        {/* ── CTA zone ────────────────────────────────────────────────── */}
        <View style={styles.ctaZone}>

          {/* Social error */}
          {!!socialError && (
            <View style={styles.socialErrorBanner}>
              <Text style={styles.socialErrorText}>{socialError}</Text>
            </View>
          )}

          {/* Primary — Sign in */}
          <TouchableOpacity
            style={[styles.btnPrimary, isBusy && styles.btnDisabled]}
            onPress={() => router.push('/auth/login')}
            disabled={isBusy}
            activeOpacity={0.82}
          >
            <Text style={styles.btnPrimaryText}>Sign in</Text>
          </TouchableOpacity>

          <View style={{ height: 12 }} />

          {/* Ghost — Create account */}
          <TouchableOpacity
            style={[styles.btnGhost, isBusy && styles.btnDisabled]}
            onPress={() => router.push('/auth/register')}
            disabled={isBusy}
            activeOpacity={0.82}
          >
            <Text style={styles.btnGhostText}>Create account</Text>
          </TouchableOpacity>

          {/* Social divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <TouchableOpacity
            style={[styles.btnSocialGoogle, isBusy && styles.btnDisabled]}
            onPress={googleSignIn}
            disabled={isBusy}
            activeOpacity={0.82}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={NAVY} />
            ) : (
              <>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.btnSocialGoogleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Apple — iOS only */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.btnSocialApple, isBusy && styles.btnDisabled]}
              onPress={appleSignIn}
              disabled={isBusy}
              activeOpacity={0.82}
            >
              {appleLoading ? (
                <ActivityIndicator size="small" color={IVORY} />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={18} color={IVORY} />
                  <Text style={styles.btnSocialAppleText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Legal */}
          <Text style={styles.legal}>
            By continuing you agree to Goldenbook Go's{'\n'}Terms of Service and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // ── Brand zone
  brandZone: {
    minHeight: H * 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
    paddingBottom: 12,
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
  headline: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 34,
    lineHeight: 41,
    color: IVORY,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  subheadline: {
    fontFamily: 'Inter_300Light',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(253,253,251,0.46)',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // ── CTA zone
  ctaZone: {
    paddingTop: 4,
  },

  // Social error banner
  socialErrorBanner: {
    backgroundColor: 'rgba(185,49,49,0.18)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  socialErrorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#FF8080',
    textAlign: 'center',
    lineHeight: 17,
  },

  // Email-path buttons
  btnPrimary: {
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
  btnPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: NAVY,
    letterSpacing: 0.3,
  },
  btnGhost: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(253,253,251,0.20)',
  },
  btnGhostText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: IVORY,
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.45,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 22,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.22)',
  },
  dividerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    letterSpacing: 2,
    color: 'rgba(253,253,251,0.28)',
  },

  // Google button — light surface on dark bg
  btnSocialGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(253,253,251,0.92)',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
    gap: 10,
  },
  googleG: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#4285F4',
    lineHeight: 20,
  },
  btnSocialGoogleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: NAVY,
    letterSpacing: 0.1,
  },

  // Apple button — always dark
  btnSocialApple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1917',
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  btnSocialAppleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: IVORY,
    letterSpacing: 0.1,
  },

  // Legal
  legal: {
    fontFamily: 'Inter_300Light',
    fontSize: 10,
    lineHeight: 16,
    color: 'rgba(253,253,251,0.20)',
    textAlign: 'center',
    marginTop: 20,
  },
});
