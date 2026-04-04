/**
 * Register Screen — Create Account
 *
 * Email + password registration via Supabase Auth.
 * On success, shows a confirmation state and lets the user navigate to login.
 * If email confirmation is disabled in Supabase, the navigation guard will
 * redirect automatically once the session is set.
 */

import React, { useState } from 'react';
import {
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

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const router  = useRouter();
  const signUp  = useAuthStore((s) => s.signUp);

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [registered, setRegistered] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passFocused, setPassFocused]   = useState(false);
  const [confFocused, setConfFocused]   = useState(false);

  const passwordsMatch = password === confirm;
  const canSubmit =
    isValidEmail(email) &&
    password.length >= 8 &&
    passwordsMatch &&
    !loading;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError('');
    setVerificationResent(false);
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password);
      setRegistered(true);
    } catch (e: any) {
      const code = e?.code ?? e?.message;

      switch (code) {
        case 'EMAIL_UNVERIFIED':
          setVerificationResent(true);
          break;
        case 'EMAIL_ALREADY_EXISTS':
          setError('An account with this email already exists. Sign in or reset your password.');
          break;
        default:
          setError('We couldn\u2019t create your account right now. Please try again.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Verification resent state (unverified existing account) ─────────────────
  if (verificationResent) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { setVerificationResent(false); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.successIconWrap}>
            <View style={[styles.successIconRing, { backgroundColor: 'rgba(210,182,138,0.08)', borderColor: 'rgba(210,182,138,0.30)' }]}>
              <Text style={styles.successIconChar}>{'✧'}</Text>
            </View>
          </View>

          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.successTitle}>Verification{'\n'}email sent.</Text>
          <Text style={styles.successBody}>
            This email is already registered but not yet verified.
          </Text>
          <Text style={[styles.successBody, { marginTop: 8, marginBottom: 0 }]}>
            We've sent a new confirmation email to
          </Text>
          <Text style={styles.successEmail}>{email.trim().toLowerCase()}</Text>
          <Text style={styles.successHint}>
            Check your inbox and spam folder.
          </Text>

          <View style={styles.goldRule} />

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/auth/login')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Go to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success / confirmation pending state ────────────────────────────────────
  if (registered) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.successContainer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/auth/login')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.successIconWrap}>
            <View style={styles.successIconRing}>
              <Text style={styles.successIconChar}>✦</Text>
            </View>
          </View>

          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.successTitle}>Account{'\n'}created.</Text>
          <Text style={styles.successBody}>
            Your account has been created.{'\n'}Please confirm your email to continue.
          </Text>
          <Text style={styles.successHint}>
            Check your inbox and spam folder for the confirmation email.
          </Text>

          <View style={styles.goldRule} />

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/auth/login')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={() => router.push('/auth/verify-email')}
          >
            <Text style={styles.resendText}>Resend confirmation email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────────
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
          {/* ── Back ──────────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            disabled={loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>

          {/* ── Heading ───────────────────────────────────────────────── */}
          <View style={styles.headingBlock}>
            <Text style={styles.ornamentStar}>✦</Text>
            <Text style={styles.heading}>Create{'\n'}account.</Text>
            <Text style={styles.subheading}>
              Create your account and start discovering{'\n'}the finest of Portugal.
            </Text>
          </View>

          {/* ── Gold rule ─────────────────────────────────────────────── */}
          <View style={styles.goldRule} />

          {/* ── Error banner ──────────────────────────────────────────── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              {error.includes('already exists') && (
                <View style={styles.errorActions}>
                  <TouchableOpacity onPress={() => router.push('/auth/login')}>
                    <Text style={styles.errorLink}>Sign in</Text>
                  </TouchableOpacity>
                  <Text style={styles.errorDot}> · </Text>
                  <TouchableOpacity onPress={() => router.push('/auth/reset-password')}>
                    <Text style={styles.errorLink}>Reset password</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Email ─────────────────────────────────────────────────── */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
            <View style={[styles.fieldBox, emailFocused && styles.fieldBoxFocused]}>
              <TextInput
                style={styles.fieldInput}
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor="rgba(34,45,82,0.30)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                returnKeyType="next"
              />
            </View>
            <Text style={styles.fieldHint}>We'll send a confirmation link to this address.</Text>
          </View>

          {/* ── Password ──────────────────────────────────────────────── */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <View style={[styles.fieldBox, passFocused && styles.fieldBoxFocused]}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor="rgba(34,45,82,0.30)"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                returnKeyType="next"
              />
              <TouchableOpacity
                onPress={() => setShowPass((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.showHide}>{showPass ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Confirm password ──────────────────────────────────────── */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <View style={[
              styles.fieldBox,
              confFocused && styles.fieldBoxFocused,
              confirm.length > 0 && !passwordsMatch && styles.fieldBoxError,
            ]}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat password"
                placeholderTextColor="rgba(34,45,82,0.30)"
                secureTextEntry={!showConf}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setConfFocused(true)}
                onBlur={() => setConfFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity
                onPress={() => setShowConf((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.showHide}>{showConf ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
            {confirm.length > 0 && !passwordsMatch && (
              <Text style={styles.fieldError}>Passwords do not match</Text>
            )}
          </View>

          {/* ── Create account CTA ────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={!canSubmit}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>
              {loading ? 'Creating account…' : 'Create account'}
            </Text>
          </TouchableOpacity>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>ALREADY A MEMBER?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Sign in link ──────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth/login')}
            disabled={loading}
            activeOpacity={0.82}
          >
            <Text style={styles.secondaryBtnText}>Sign in</Text>
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
    color: 'rgba(34,45,82,0.48)',
    letterSpacing: 0.1,
  },

  // Gold rule
  goldRule: {
    height: 1,
    backgroundColor: 'rgba(210,182,138,0.35)',
    marginBottom: 28,
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
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: GOLD,
  },
  errorDot: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(34,45,82,0.30)',
  },

  // Fields
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(34,45,82,0.38)',
    marginBottom: 8,
  },
  fieldHint: {
    fontFamily: 'Inter_300Light',
    fontSize: 11,
    color: 'rgba(34,45,82,0.38)',
    letterSpacing: 0.1,
    marginTop: 6,
  },
  fieldError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#B93131',
    marginTop: 6,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAF8',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(34,45,82,0.10)',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldBoxFocused: {
    borderColor: GOLD,
    backgroundColor: IVORY,
  },
  fieldBoxError: {
    borderColor: '#B93131',
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
    color: 'rgba(34,45,82,0.35)',
    marginLeft: 12,
  },

  // Primary CTA
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
  btnDisabled: {
    backgroundColor: 'rgba(34,45,82,0.15)',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
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
    color: 'rgba(34,45,82,0.28)',
  },

  // Secondary button
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(34,45,82,0.12)',
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: NAVY,
    letterSpacing: 0.3,
  },

  // Success state
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  successIconWrap: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 28,
  },
  successIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(210,182,138,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(210,182,138,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconChar: {
    fontSize: 28,
    color: GOLD,
  },
  successTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 32,
    lineHeight: 38,
    color: NAVY,
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 14,
  },
  successBody: {
    fontFamily: 'Inter_300Light',
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(34,45,82,0.55)',
    letterSpacing: 0.1,
    marginBottom: 28,
  },
  successEmail: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: NAVY,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 14,
  },
  successHint: {
    fontFamily: 'Inter_300Light',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(34,45,82,0.40)',
    letterSpacing: 0.1,
    marginBottom: 28,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  resendText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: GOLD,
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
  },
});
