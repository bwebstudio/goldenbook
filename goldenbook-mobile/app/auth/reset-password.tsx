/**
 * Reset Password Screen
 *
 * Two states:
 *   1. Request — user enters email, taps "Send reset link"
 *   2. Success — confirmation with email address shown, resend option
 *
 * Uses Supabase resetPasswordForEmail under the hood (via authStore).
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

export default function ResetPasswordScreen() {
  const router        = useRouter();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sent, setSent]         = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const canSubmit = isValidEmail(email) && !loading;

  const handleSend = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success state ───────────────────────────────────────────────────────────
  if (sent) {
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

          {/* Icon */}
          <View style={styles.successIconWrap}>
            <View style={styles.successIconRing}>
              <Text style={styles.successIconChar}>✉</Text>
            </View>
          </View>

          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.successTitle}>Check your inbox</Text>
          <Text style={styles.successBody}>
            We've sent a password reset link to
          </Text>
          <Text style={styles.successEmail}>{email.trim().toLowerCase()}</Text>
          <Text style={styles.successHint}>
            Follow the link in the email to set a new password.{'\n'}The link expires in 60 minutes.
          </Text>

          <View style={styles.goldRule} />

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/auth/login')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>Back to sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={() => setSent(false)}
          >
            <Text style={styles.resendText}>Resend email</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Request state ───────────────────────────────────────────────────────────
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
            <Text style={styles.heading}>Reset{'\n'}password.</Text>
            <Text style={styles.subheading}>
              Enter your email address and we'll send you a secure link to reset your password.
            </Text>
          </View>

          {/* ── Gold rule ─────────────────────────────────────────────── */}
          <View style={styles.goldRule} />

          {/* ── Error banner ──────────────────────────────────────────── */}
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
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
                returnKeyType="done"
                onSubmitEditing={handleSend}
              />
            </View>
          </View>

          {/* ── Send CTA ──────────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleSend}
            disabled={!canSubmit}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Text>
          </TouchableOpacity>

          {/* ── Back to sign in ───────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.backToLoginBtn}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.backToLoginText}>Back to sign in</Text>
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

  // Field
  fieldWrapper: { marginBottom: 24 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(34,45,82,0.38)',
    marginBottom: 8,
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
  fieldInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: NAVY,
    padding: 0,
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

  // Back to sign in
  backToLoginBtn: {
    alignItems: 'center',
    paddingVertical: 18,
    marginTop: 4,
  },
  backToLoginText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: GOLD,
    letterSpacing: 0.2,
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
    marginBottom: 12,
  },
  successBody: {
    fontFamily: 'Inter_300Light',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(34,45,82,0.55)',
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  successEmail: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: NAVY,
    letterSpacing: 0.1,
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
