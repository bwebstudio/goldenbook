/**
 * Login Screen — email + password only.
 * Social auth (Google, Apple) lives exclusively on the Auth Entry screen.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/i18n';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

// ─── Component ────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const t      = useTranslation();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length >= 1 && !loading;

  const [needsVerification, setNeedsVerification] = useState(false);

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const code = e?.code ?? e?.message;

      if (code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
      } else if (e.message?.toLowerCase().includes('invalid login credentials')) {
        setError(t.authErrors.invalidCredentials);
      } else {
        setError(t.authErrors.signInFailedGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Back ────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            disabled={loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* ── Heading ─────────────────────────────────────────────── */}
          <View style={styles.headingBlock}>
            <Text style={styles.ornamentStar}>✦</Text>
            <Text style={styles.heading}>{t.auth.loginHeading}</Text>
            <Text style={styles.subheading}>
              {t.auth.loginSubheading}
            </Text>
          </View>

          {/* ── Gold rule ───────────────────────────────────────────── */}
          <View style={styles.goldRule} />

          {/* ── Verification needed banner ──────────────────────────────── */}
          {needsVerification && (
            <View style={styles.verifyBanner}>
              <Text style={styles.verifyTitle}>{t.auth.verifyBannerTitle}</Text>
              <Text style={styles.verifyText}>
                {t.auth.verifyBannerBody}
              </Text>
              <TouchableOpacity
                style={styles.verifyResendBtn}
                onPress={() => router.push('/auth/verify-email')}
              >
                <Text style={styles.verifyResendText}>{t.auth.verifyBannerResend}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Error banner ─────────────────────────────────────────── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Email ───────────────────────────────────────────────── */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t.auth.emailLabel}</Text>
            <View style={[styles.fieldBox, emailFocused && styles.fieldBoxFocused]}>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder={t.auth.emailPlaceholder}
                placeholderTextColor="rgba(34,45,82,0.28)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                returnKeyType="next"
              />
            </View>
          </View>

          {/* ── Password ─────────────────────────────────────────────── */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t.auth.passwordLabel}</Text>
            <View style={[styles.fieldBox, passwordFocused && styles.fieldBoxFocused]}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={t.auth.passwordPlaceholder}
                placeholderTextColor="rgba(34,45,82,0.28)"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.showHide}>{showPass ? t.auth.hidePassword : t.auth.showPassword}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Migration notice (Firebase → Supabase) ──────────────────
              Subtle hint for users coming from the previous app version
              whose passwords could not be carried over. */}
          <Text style={styles.migrationNotice}>
            {t.auth.migrationNoticeBefore}
            <Text
              style={styles.migrationNoticeLink}
              onPress={() => router.push('/auth/reset-password')}
            >
              {t.auth.migrationNoticeLink}
            </Text>
            {t.auth.migrationNoticeAfter}
          </Text>

          {/* ── Forgot password ──────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/auth/reset-password')}
            disabled={loading}
          >
            <Text style={styles.forgotText}>{t.auth.forgotPassword}</Text>
          </TouchableOpacity>

          {/* ── Sign in CTA ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnPrimaryDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
            activeOpacity={0.82}
          >
            {loading ? (
              <ActivityIndicator size="small" color={IVORY} />
            ) : (
              <Text style={styles.btnPrimaryText}>{t.auth.signIn}</Text>
            )}
          </TouchableOpacity>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t.auth.newToGoldenbook}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Create account link ──────────────────────────────────── */}
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/auth/register')}
            disabled={loading}
            activeOpacity={0.82}
          >
            <Text style={styles.btnSecondaryText}>{t.auth.createAccount}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IVORY },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Back
  backBtn: {
    paddingTop: 14,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 22,
    color: NAVY,
    fontFamily: 'Inter_300Light',
  },

  // Heading
  headingBlock: {
    marginTop: 12,
    marginBottom: 24,
  },
  ornamentStar: {
    fontSize: 12,
    color: GOLD,
    marginBottom: 10,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 38,
    lineHeight: 44,
    color: NAVY,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subheading: {
    fontFamily: 'Inter_300Light',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(34,45,82,0.46)',
    letterSpacing: 0.1,
  },

  // Gold rule
  goldRule: {
    height: 1,
    backgroundColor: 'rgba(210,182,138,0.32)',
    marginBottom: 28,
  },

  // Verification needed
  verifyBanner: {
    backgroundColor: 'rgba(210,182,138,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  verifyTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: NAVY,
    marginBottom: 4,
  },
  verifyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(34,45,82,0.60)',
    lineHeight: 18,
  },
  verifyResendBtn: {
    marginTop: 10,
  },
  verifyResendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: GOLD,
    textDecorationLine: 'underline',
  },

  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(185,49,49,0.07)',
    borderLeftWidth: 3,
    borderLeftColor: '#B93131',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#B93131',
    lineHeight: 18,
  },

  // Fields
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(34,45,82,0.36)',
    marginBottom: 8,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(34,45,82,0.09)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldBoxFocused: {
    borderColor: GOLD,
    backgroundColor: IVORY,
  },
  fieldInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: NAVY,
    padding: 0,
  },
  showHide: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(34,45,82,0.33)',
    marginLeft: 12,
  },

  // Migration notice (Firebase → Supabase)
  migrationNotice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(34,45,82,0.50)',
    marginTop: 4,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  migrationNoticeLink: {
    fontFamily: 'Inter_500Medium',
    color: GOLD,
    textDecorationLine: 'underline',
  },

  // Forgot password
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 24,
    paddingVertical: 4,
  },
  forgotText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: GOLD,
    letterSpacing: 0.2,
  },

  // Primary CTA
  btnPrimary: {
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  btnPrimaryDisabled: {
    backgroundColor: 'rgba(34,45,82,0.14)',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: IVORY,
    letterSpacing: 0.3,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 28,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.35)',
  },
  dividerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(34,45,82,0.26)',
  },

  // Secondary button
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(34,45,82,0.11)',
  },
  btnSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: NAVY,
    letterSpacing: 0.3,
  },
});
