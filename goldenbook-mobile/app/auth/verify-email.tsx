/**
 * Verify Email Screen
 *
 * Handles the deep link from the verification email.
 * If no token in URL, shows resend option for logged-in users.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/api/endpoints';
import { useTranslation } from '@/i18n';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const t      = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'no_token'>('loading');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('no_token');
      return;
    }

    api.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => {
        setStatus('error');
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    try {
      await api.resendVerification();
      setResent(true);
    } catch {
      // ignore — user may not be logged in
    }
    setResending(false);
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>{t.auth.verifying}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <View style={styles.iconRing}>
              <Text style={styles.iconChar}>✓</Text>
            </View>
          </View>
          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.title}>{t.auth.emailVerifiedTitle}</Text>
          <Text style={styles.body}>
            {t.auth.emailVerifiedBody}
          </Text>
          <View style={styles.goldRule} />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>{t.auth.continueCta}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error / Expired ────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconRing, styles.iconRingError]}>
              <Text style={styles.iconCharError}>!</Text>
            </View>
          </View>
          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.title}>{t.auth.verificationFailedTitle}</Text>
          <Text style={styles.body}>{t.auth.invalidOrExpiredLink}</Text>
          <View style={styles.goldRule} />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleResend}
            disabled={resending || resent}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>
              {resent ? t.auth.emailSent : resending ? t.auth.sendingShort : t.auth.resendVerification}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.backText}>{t.auth.backToSignIn}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── No token — show resend option ─────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.navBackArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={styles.iconRing}>
            <Text style={styles.iconChar}>{'✧'}</Text>
          </View>
        </View>
        <Text style={styles.ornamentStar}>✦</Text>
        <Text style={styles.title}>{t.auth.verifyYourEmailTitle}</Text>
        <Text style={styles.body}>
          {t.auth.verifyYourEmailBody}
        </Text>
        <View style={styles.goldRule} />
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleResend}
          disabled={resending || resent}
          activeOpacity={0.82}
        >
          <Text style={styles.btnText}>
            {resent ? t.auth.emailSent : resending ? t.auth.sendingShort : t.auth.resendVerification}
          </Text>
        </TouchableOpacity>
        {resent && (
          <Text style={styles.resentHint}>
            {t.auth.checkInboxExpiresIn24h}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IVORY },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(34,45,82,0.55)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  navBackBtn: {
    paddingTop: 14,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  navBackArrow: {
    fontSize: 22,
    color: NAVY,
    fontFamily: 'Inter_300Light',
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 28,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(210,182,138,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(210,182,138,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingError: {
    backgroundColor: 'rgba(185,49,49,0.07)',
    borderColor: 'rgba(185,49,49,0.25)',
  },
  iconChar: {
    fontSize: 28,
    color: GOLD,
  },
  iconCharError: {
    fontSize: 28,
    color: '#B93131',
  },
  ornamentStar: {
    fontSize: 12,
    color: GOLD,
    marginBottom: 10,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 38,
    color: NAVY,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 14,
  },
  body: {
    fontFamily: 'Inter_300Light',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(34,45,82,0.55)',
    letterSpacing: 0.1,
    marginBottom: 28,
  },
  goldRule: {
    height: 1,
    backgroundColor: 'rgba(210,182,138,0.35)',
    marginBottom: 28,
  },
  btnPrimary: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  btnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: IVORY,
    letterSpacing: 0.3,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  backText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: GOLD,
    letterSpacing: 0.2,
  },
  resentHint: {
    fontFamily: 'Inter_300Light',
    fontSize: 12,
    color: 'rgba(34,45,82,0.40)',
    textAlign: 'center',
    marginTop: 12,
  },
});
