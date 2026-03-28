import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettingsStore, type Locale } from '@/store/settingsStore';
import { useTranslation } from '@/i18n';
import { colors, typography, spacing, radius } from '@/design/tokens';

// ─── Language options ─────────────────────────────────────────────────────────

const LANGUAGES: { locale: Locale; label: string; nativeLabel: string; code: string }[] = [
  { locale: 'en',    label: 'English',              nativeLabel: 'English',              code: 'EN' },
  { locale: 'pt-PT', label: 'Português (Portugal)',  nativeLabel: 'Português (Portugal)', code: 'PT' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LanguageScreen() {
  const router    = useRouter();
  const t         = useTranslation();
  const locale    = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  return (
    <SafeAreaView style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.navy.DEFAULT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t.language.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        {/* Section label */}
        <Text style={styles.sectionLabel}>{t.language.subtitle}</Text>

        {/* Language rows */}
        <View style={styles.card}>
          {LANGUAGES.map((lang, i) => {
            const isSelected = locale === lang.locale;
            const isLast = i === LANGUAGES.length - 1;
            return (
              <TouchableOpacity
                key={lang.locale}
                onPress={() => setLocale(lang.locale)}
                activeOpacity={0.65}
                style={[styles.row, !isLast && styles.rowDivider]}
              >
                {/* Code badge + label */}
                <View style={styles.rowLeft}>
                  <View style={[styles.codeBadge, isSelected && styles.codeBadgeSelected]}>
                    <Text style={[styles.codeText, isSelected && styles.codeTextSelected]}>{lang.code}</Text>
                  </View>
                  <View style={styles.rowTexts}>
                    <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                      {lang.nativeLabel}
                    </Text>
                    {isSelected && (
                      <Text style={styles.currentBadge}>{t.language.current}</Text>
                    )}
                  </View>
                </View>

                {/* Checkmark */}
                {isSelected ? (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                ) : (
                  <View style={{ width: 20 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.ivory.DEFAULT,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.body,
    fontFamily: typography.sansSemibold,
    color: colors.navy.DEFAULT,
    marginHorizontal: spacing.sm,
    letterSpacing: 0.2,
  },

  // ── Body ──
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: `${colors.navy.DEFAULT}60`,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}12`,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.cardPadding,
    paddingVertical: spacing.base + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${colors.navy.DEFAULT}08`,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  codeBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: `${colors.navy.DEFAULT}08`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.navy.DEFAULT}14`,
  },
  codeBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  codeText: {
    fontSize: 11,
    fontFamily: typography.sansSemibold,
    color: `${colors.navy.DEFAULT}60`,
    letterSpacing: 0.5,
  },
  codeTextSelected: {
    color: '#FFFFFF',
  },
  rowTexts: {
    gap: 2,
  },
  rowLabel: {
    fontSize: typography.bodySmall,
    fontFamily: typography.sans,
    color: `${colors.navy.DEFAULT}80`,
    letterSpacing: 0.1,
  },
  rowLabelSelected: {
    fontFamily: typography.sansMedium,
    color: colors.navy.DEFAULT,
  },
  currentBadge: {
    fontSize: typography.label,
    fontFamily: typography.sansSemibold,
    color: colors.primary,
    letterSpacing: typography.wide,
    textTransform: 'uppercase',
  },
});
