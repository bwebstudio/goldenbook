import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { TabActions } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, DevSettings, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { LOCALITY_BY_SLUG } from '@/config/localities';
import { useTranslation } from '@/i18n';
import { colors, typography, spacing, radius } from '@/design/tokens';
import { api } from '@/api/endpoints';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(
  user: { user_metadata?: Record<string, any>; email?: string | null } | null,
): string {
  if (!user) return '?';
  const meta = user.user_metadata ?? {};
  const name: string = meta.full_name ?? meta.name ?? meta.display_name ?? '';
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return '?';
}

// ─── MenuRow ─────────────────────────────────────────────────────────────────

interface MenuRowProps {
  label: string;
  onPress: () => void;
  isLast?: boolean;
  destructive?: boolean;
}

function MenuRow({ label, onPress, isLast = false, destructive = false }: MenuRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={[styles.row, !isLast && styles.rowDivider]}
    >
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color={`${colors.navy.DEFAULT}30`} />
      )}
    </TouchableOpacity>
  );
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const t      = useTranslation();

  const user            = useAuthStore((s) => s.user);
  const signOut         = useAuthStore((s) => s.signOut);
  const selectedCity    = useAppStore((s) => s.selectedCity);
  const resetLocality   = useAppStore((s) => s.resetLocalitySelection);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);

  const meta        = user?.user_metadata ?? {};
  const displayName: string | null = meta.full_name ?? meta.name ?? meta.display_name ?? null;
  const email       = user?.email ?? null;
  const photoURL    = meta.avatar_url ?? meta.picture ?? null;
  const initials    = getInitials(user);
  const locality    = LOCALITY_BY_SLUG[selectedCity];
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    // Step 1: First confirmation
    Alert.alert(t.profile.deleteAccountTitle, t.profile.deleteAccountMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deleteAccountConfirm,
        style: 'destructive',
        onPress: () => {
          // Step 2: Final confirmation
          Alert.alert(t.profile.deleteAccountFinalTitle, t.profile.deleteAccountFinalMessage, [
            { text: t.common.cancel, style: 'cancel' },
            {
              text: t.profile.deleteAccountConfirm,
              style: 'destructive',
              onPress: async () => {
                try {
                  setDeleting(true);
                  await api.deleteAccount();
                  Alert.alert('', t.profile.deleteAccountSuccess);
                  await signOut();
                } catch {
                  Alert.alert(t.common.error, t.profile.deleteAccountError);
                } finally {
                  setDeleting(false);
                }
              },
            },
          ]);
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert(t.profile.signOutTitle, t.profile.signOutMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.signOut,
        style: 'destructive',
        // Navigation guard in _layout.tsx automatically redirects to /auth
        // when session becomes null after signOut().
        onPress: signOut,
      },
    ]);
  };

  const resetOnboardingOnly = async () => {
    if (!__DEV__) return;
    await resetOnboarding();
    DevSettings.reload();
  };

  // ── Close profile: return to the previous tab ────────────────────────
  // Profile is a tab, not a modal — router.back() doesn't work reliably
  // because tabs are siblings, not stacked. Instead, we read the tab
  // navigator's history to find which tab the user came from and jump there.
  const tabNav = useNavigation().getParent();

  const handleClose = () => {
    // Try to find the previous tab from the navigator's history
    const state = tabNav?.getState();
    if (state?.history) {
      // history entries for tabs look like { type: 'tab', key: '...' }
      const tabHistory = (state.history as any[]).filter((h) => h.type === 'tab');
      // The last entry is "profile" (current), the one before is where we came from
      const prev = tabHistory.length >= 2 ? tabHistory[tabHistory.length - 2] : null;
      if (prev) {
        const route = state.routes.find((r: any) => r.key === prev.key);
        if (route?.name && route.name !== 'profile') {
          tabNav?.dispatch(TabActions.jumpTo(route.name));
          return;
        }
      }
    }
    // Fallback: go to Discover (index)
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Close button ── */}
      <View style={styles.closeRow}>
        <TouchableOpacity
          onPress={handleClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={24} color={colors.navy.DEFAULT} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero / Avatar ── */}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>

          {displayName ? (
            <Text style={styles.heroName}>{displayName}</Text>
          ) : null}

          {email ? (
            <Text style={styles.heroEmail}>{email}</Text>
          ) : null}

          {locality ? (
            <View style={styles.cityPill}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={styles.cityLabel}>
                {locality.name}, {locality.country}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Menu sections ── */}
        <View style={styles.sections}>
          <SectionCard title={t.profile.myAccount}>
            <MenuRow
              label={t.profile.savedPlaces}
              onPress={() => router.push('/(tabs)/saved')}
            />
            <MenuRow
              label={t.profile.savedRoutes}
              onPress={() =>
                router.push({ pathname: '/(tabs)/saved', params: { tab: 'routes' } })
              }
            />
            <MenuRow
              label={t.profile.myPreferences}
              onPress={() => router.push('/preferences')}
            />
            <MenuRow
              label={t.profile.language}
              onPress={() => router.push('/language')}
            />
            <MenuRow
              label={t.profile.notifications}
              onPress={() =>
                router.push({ pathname: '/info', params: { contentKey: 'notifications' } })
              }
            />
            <MenuRow
              label={t.profile.changeDestination}
              onPress={() => router.push('/select-destination')}
              isLast
            />
          </SectionCard>

          <SectionCard title={t.profile.information}>
            <MenuRow
              label={t.profile.about}
              onPress={() => router.push({ pathname: '/info', params: { contentKey: 'about' } })}
            />
            <MenuRow
              label={t.profile.contact}
              onPress={() => router.push({ pathname: '/info', params: { contentKey: 'contact' } })}
            />
            <MenuRow
              label={t.profile.privacy}
              onPress={() => router.push({ pathname: '/info', params: { contentKey: 'privacy' } })}
            />
            <MenuRow
              label={t.profile.terms}
              onPress={() => router.push({ pathname: '/info', params: { contentKey: 'terms' } })}
              isLast
            />
          </SectionCard>

          {/* ── Delete account & Sign out ── */}
          <View style={[styles.sectionCard, styles.section]}>
            {deleting ? (
              <View style={[styles.row, styles.rowDivider]}>
                <ActivityIndicator size="small" color="#B94040" />
                <Text style={[styles.rowLabel, styles.rowLabelDestructive, { marginLeft: spacing.sm }]}>
                  {t.profile.deleting}
                </Text>
              </View>
            ) : (
              <MenuRow label={t.profile.deleteAccount} onPress={handleDeleteAccount} destructive />
            )}
            <MenuRow label={t.profile.signOut} onPress={handleSignOut} destructive isLast />
          </View>

          {/* Dev tools removed — use Expo DevMenu instead */}
        </View>

        <View style={{ height: spacing.xxxl }} />
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingTop: spacing.sm,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navy.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 30,
    fontFamily: typography.sansSemibold,
    color: colors.primary,
    letterSpacing: 1,
  },
  heroName: {
    fontFamily: typography.serif,
    fontSize: typography.title,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.tight,
    marginBottom: spacing.xs,
  },
  heroEmail: {
    fontSize: typography.caption,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}50`,
    marginBottom: spacing.md,
    letterSpacing: 0.2,
  },
  cityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}14`,
  },
  cityLabel: {
    fontSize: typography.caption,
    fontFamily: typography.sansMedium,
    color: `${colors.navy.DEFAULT}65`,
    marginLeft: 3,
    letterSpacing: 0.2,
  },

  // ── Sections ──
  sections: {
    paddingHorizontal: spacing.screenPadding,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: `${colors.navy.DEFAULT}40`,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}12`,
    overflow: 'hidden',
  },

  // ── Rows ──
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: spacing.base + 1,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.navy.DEFAULT}08`,
  },
  rowLabel: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sans,
    color: colors.navy.DEFAULT,
    letterSpacing: 0.1,
  },
  rowLabelDestructive: {
    color: '#B94040',
  },

  // ── Dev tools ──
  devSection: {
    marginBottom: spacing.lg,
  },
  devLabel: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: `${colors.navy.DEFAULT}40`,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  devCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F0D8A0',
    overflow: 'hidden',
  },
  devRow: {
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: spacing.base + 1,
  },
  devRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0D8A0',
  },
  devRowText: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sans,
    color: '#92400E',
  },
});
