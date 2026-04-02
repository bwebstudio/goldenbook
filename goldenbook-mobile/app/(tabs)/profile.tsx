import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, DevSettings, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { LOCALITY_BY_SLUG } from '@/config/localities';
import { useTranslation } from '@/i18n';
import { colors, typography, spacing, radius } from '@/design/tokens';

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

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Close button ── */}
      <View style={styles.closeRow}>
        <TouchableOpacity
          onPress={() => router.back()}
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

          {/* ── Sign out ── */}
          <View style={[styles.sectionCard, styles.section]}>
            <MenuRow label={t.profile.signOut} onPress={handleSignOut} destructive isLast />
          </View>

          {/* ── Dev tools — only in development builds ── */}
          {__DEV__ && (
            <View style={styles.devSection}>
              <Text style={styles.devLabel}>{t.profile.devTools}</Text>
              <View style={styles.devCard}>
                <TouchableOpacity
                  style={[styles.devRow, styles.devRowDivider]}
                  onPress={resetOnboardingOnly}
                  activeOpacity={0.7}
                >
                  <Text style={styles.devRowText}>{t.profile.resetOnboarding}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devRow}
                  onPress={() => { resetLocality(); resetOnboarding(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.devRowText}>{t.profile.resetLocality}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
