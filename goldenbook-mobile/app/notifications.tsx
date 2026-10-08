/**
 * Notifications screen
 *
 * One switch: the daily 18:00 ritual. Turning it on asks for the system
 * permission (the only place besides the post-save invite that does). When
 * the system no longer lets us ask, the screen says so and links to Settings.
 *
 * The switch reflects both halves: the user's choice in the app and the OS
 * permission. It is re-read when the app returns to the foreground, since
 * the user may have changed it in Settings meanwhile.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { enablePush, disablePush } from '@/features/push';
import { colors, typography, spacing, radius } from '@/design/tokens';

type PermissionState = 'granted' | 'askable' | 'blocked';

async function readPermission(): Promise<PermissionState> {
  const perms = await Notifications.getPermissionsAsync();
  if (perms.granted) return 'granted';
  return perms.canAskAgain ? 'askable' : 'blocked';
}

export default function NotificationsScreen() {
  const router = useRouter();
  const t = useTranslation();
  const tn = t.notificationsScreen;

  const pushOptIn = useSettingsStore((s) => s.pushOptIn);
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshPermission = useCallback(() => {
    void readPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refreshPermission();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const isOn = permission === 'granted' && pushOptIn !== false;

  const onToggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (next) {
        const result = await enablePush();
        if (result === 'unavailable') Alert.alert('', tn.failed);
      } else {
        await disablePush();
      }
    } finally {
      refreshPermission();
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t.common.goBack}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.navy.DEFAULT} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {tn.title}
          </Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero text ── */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{tn.heroTitle}</Text>
          <Text style={styles.heroBody}>{tn.heroBody}</Text>
        </View>

        <View style={styles.divider} />

        {/* ── Ritual switch ── */}
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{tn.ritualLabel}</Text>
            <Text style={styles.rowHint}>{tn.ritualHint}</Text>
          </View>
          <Switch
            value={isOn}
            onValueChange={(v) => void onToggle(v)}
            disabled={busy || permission === null || permission === 'blocked'}
            trackColor={{ false: `${colors.navy.DEFAULT}20`, true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={`${colors.navy.DEFAULT}20`}
            accessibilityLabel={tn.ritualLabel}
          />
        </View>

        {/* ── Blocked by the OS ── */}
        {permission === 'blocked' && (
          <View style={styles.blocked}>
            <Text style={styles.blockedText}>{tn.blocked}</Text>
            <TouchableOpacity
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.blockedLink}>{tn.openSettings}</Text>
            </TouchableOpacity>
          </View>
        )}
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

  // ── Header ── (same as Preferences)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.navy.DEFAULT}0D`,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: typography.body,
    fontFamily: typography.sansSemibold,
    color: colors.navy.DEFAULT,
    letterSpacing: 0.2,
  },
  headerRight: {
    width: 40,
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // ── Hero ──
  hero: {
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontFamily: typography.serifBold,
    fontSize: typography.title,
    color: colors.navy.DEFAULT,
    letterSpacing: typography.tight,
    marginBottom: spacing.sm,
    lineHeight: 30,
  },
  heroBody: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}65`,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${colors.navy.DEFAULT}12`,
    marginBottom: spacing.lg,
  },

  // ── Switch row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}18`,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: typography.body,
    fontFamily: typography.sansSemibold,
    color: colors.navy.DEFAULT,
    marginBottom: 2,
  },
  rowHint: {
    fontSize: typography.caption,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}60`,
    lineHeight: 18,
  },

  // ── Blocked ──
  blocked: {
    marginTop: spacing.base,
    paddingHorizontal: 2,
    gap: spacing.sm,
  },
  blockedText: {
    fontSize: typography.caption,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}70`,
    lineHeight: 18,
  },
  blockedLink: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: colors.primary,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },
});
