/**
 * Reset Password Confirm Screen
 *
 * User arrives here from the password reset email deep link.
 * Accepts token from URL params and lets user set a new password.
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/api/endpoints';
import { useTranslation } from '@/i18n';

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

export default function ResetPasswordConfirmScreen() {
  const router = useRouter();
  const t      = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [passFocused, setPassFocused] = useState(false);
  const [confFocused, setConfFocused] = useState(false);

  // Password policy: at least 8 chars, must contain at least one letter AND one digit.
  const isValidPassword = (pw: string) =>
    pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

  const passwordValid    = isValidPassword(password);
  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordWeak     = password.length >= 8 && !passwordValid;

  // Per-rule status (used by the visible checklist below the input).
  const ruleLength = password.length >= 8;
  const ruleAlnum  = /[A-Za-z]/.test(password) && /\d/.test(password);

  const passwordsMatch = password === confirm;
  const canSubmit = passwordValid && passwordsMatch && !loading && !!token;

  const handleReset = async () => {
    if (!canSubmit || !token) return;
    setError('');
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
    } catch {
      setError(t.authErrors.resetConfirmFailed);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <View style={[styles.iconRing, styles.iconRingError]}>
              <Text style={styles.iconCharError}>!</Text>
            </View>
          </View>
          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.title}>{t.auth.invalidLinkTitle}</Text>
          <Text style={styles.body}>
            {t.auth.invalidLinkBody}
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/auth/reset-password')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>{t.auth.requestNewLink}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (success) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.iconWrap}>
            <View style={styles.iconRing}>
              <Text style={styles.iconChar}>✓</Text>
            </View>
          </View>
          <Text style={styles.ornamentStar}>✦</Text>
          <Text style={styles.title}>{t.auth.resetSuccessTitle}</Text>
          <Text style={styles.body}>
            {t.auth.resetSuccessBody}
          </Text>
          <View style={styles.goldRule} />
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/auth/login')}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>{t.auth.signIn}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => router.back()}
            disabled={loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.navBackArrow}>←</Text>
          </TouchableOpacity>

          <View style={styles.headingBlock}>
            <Text style={styles.ornamentStar}>✦</Text>
            <Text style={styles.heading}>{t.auth.resetConfirmHeading}</Text>
            <Text style={styles.subheading}>
              {t.auth.resetConfirmSubheading}
            </Text>
          </View>

          <View style={styles.goldRule} />

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t.auth.newPasswordLabel}</Text>
            <View style={[
              styles.fieldBox,
              passFocused && styles.fieldBoxFocused,
              (passwordTooShort || passwordWeak) && styles.fieldBoxError,
            ]}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder={t.auth.passwordPlaceholderLong}
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
                <Text style={styles.showHide}>{showPass ? t.auth.hidePassword : t.auth.showPassword}</Text>
              </TouchableOpacity>
            </View>
            {/* Always-visible rules block. The user asked for an explicit
                "Password must contain" checklist instead of a one-line hint
                that only appears after a typo. */}
            <View style={styles.rulesBox}>
              <Text style={styles.rulesTitle}>{t.auth.passwordRulesTitle}</Text>
              <View style={styles.ruleRow}>
                <Text style={[styles.ruleMark, ruleLength && styles.ruleMarkOk]}>
                  {ruleLength ? '✓' : '•'}
                </Text>
                <Text style={[styles.ruleText, ruleLength && styles.ruleTextOk]}>
                  {t.auth.passwordRuleLength}
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <Text style={[styles.ruleMark, ruleAlnum && styles.ruleMarkOk]}>
                  {ruleAlnum ? '✓' : '•'}
                </Text>
                <Text style={[styles.ruleText, ruleAlnum && styles.ruleTextOk]}>
                  {t.auth.passwordRuleAlnum}
                </Text>
              </View>
            </View>
            {passwordTooShort ? (
              <Text style={styles.fieldError}>{t.auth.passwordTooShort}</Text>
            ) : passwordWeak ? (
              <Text style={styles.fieldError}>{t.auth.passwordNeedsLettersAndNumbers}</Text>
            ) : null}
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>{t.auth.confirmPasswordLabel}</Text>
            <View style={[
              styles.fieldBox,
              confFocused && styles.fieldBoxFocused,
              confirm.length > 0 && !passwordsMatch && styles.fieldBoxError,
            ]}>
              <TextInput
                style={[styles.fieldInput, { flex: 1 }]}
                value={confirm}
                onChangeText={setConfirm}
                placeholder={t.auth.confirmPasswordPlaceholder}
                placeholderTextColor="rgba(34,45,82,0.30)"
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onFocus={() => setConfFocused(true)}
                onBlur={() => setConfFocused(false)}
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
            </View>
            {confirm.length > 0 && !passwordsMatch && (
              <Text style={styles.fieldError}>{t.auth.passwordsDoNotMatch}</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, !canSubmit && styles.btnDisabled]}
            onPress={handleReset}
            disabled={!canSubmit}
            activeOpacity={0.82}
          >
            <Text style={styles.btnText}>
              {loading ? t.auth.resetting : t.auth.resetConfirmButton}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IVORY },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
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
  goldRule: {
    height: 1,
    backgroundColor: 'rgba(210,182,138,0.35)',
    marginBottom: 28,
  },
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
  fieldWrapper: { marginBottom: 16 },
  fieldLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 2,
    color: 'rgba(34,45,82,0.38)',
    marginBottom: 8,
  },
  fieldError: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: '#B93131',
    marginTop: 6,
  },
  fieldHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(34,45,82,0.45)',
    marginTop: 6,
  },
  // ── Password rules block ──
  rulesBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(210,182,138,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.22)',
  },
  rulesTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.6,
    color: 'rgba(34,45,82,0.55)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  ruleMark: {
    width: 14,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: 'rgba(34,45,82,0.35)',
  },
  ruleMarkOk: {
    color: GOLD,
  },
  ruleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(34,45,82,0.55)',
  },
  ruleTextOk: {
    color: NAVY,
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
});
