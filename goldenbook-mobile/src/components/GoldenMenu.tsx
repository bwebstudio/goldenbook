// ─── GoldenMenu ───────────────────────────────────────────────────────────────
//
// Lightweight right-side panel triggered by the hamburger icon on Discover.
//
// Responsibility: secondary navigation and informational access only.
//   - City utility (Change Destination)
//   - Legal / info pages (About, Contact, Privacy, Terms)
//
// NOT here: account actions, sign out, preferences, language, saved items.
// Those live exclusively on the Profile tab.
//
// Usage:
//   <GoldenMenu visible={open} onClose={() => setOpen(false)} />

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/appStore';
import { LOCALITY_BY_SLUG } from '@/config/localities';
import { useTranslation } from '@/i18n';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD  = '#D2B68A';
const NAVY  = '#222D52';
const IVORY = '#FDFDFB';

const PANEL_WIDTH     = 288;
const SLIDE_DISTANCE  = PANEL_WIDTH + 20;

// ─── Types ────────────────────────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  label: string;
  icon: IoniconName;
  onPress: () => void;
}

// ─── MenuRow ──────────────────────────────────────────────────────────────────

function MenuRow({ item, isLast }: { item: MenuItem; isLast?: boolean }) {
  return (
    <>
      <TouchableOpacity
        onPress={item.onPress}
        activeOpacity={0.65}
        style={styles.menuRow}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={item.icon} size={16} color={NAVY} />
        </View>
        <Text style={styles.menuLabel}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={13} color={`${NAVY}28`} />
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );
}

// ─── GoldenMenu ───────────────────────────────────────────────────────────────

interface GoldenMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function GoldenMenu({ visible, onClose }: GoldenMenuProps) {
  const router       = useRouter();
  const t            = useTranslation();
  const selectedCity = useAppStore((s) => s.selectedCity);
  const locality     = LOCALITY_BY_SLUG[selectedCity];

  // Slide in from the right
  const slideAnim = useRef(new Animated.Value(SLIDE_DISTANCE)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 13,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SLIDE_DISTANCE,
        duration: 210,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const go = (path: string, params?: Record<string, string>) => {
    onClose();
    setTimeout(() => {
      if (params) {
        router.push({ pathname: path as any, params });
      } else {
        router.push(path as any);
      }
    }, 180);
  };

  // ── Utility ──────────────────────────────────────────────────────────────────
  const utilityItems: MenuItem[] = [
    {
      label: t.profile.changeDestination,
      icon: 'location-outline',
      onPress: () => go('/select-destination'),
    },
  ];

  // ── Information ──────────────────────────────────────────────────────────────
  const infoItems: MenuItem[] = [
    {
      label: t.profile.about,
      icon: 'information-circle-outline',
      onPress: () => go('/info', { contentKey: 'about' }),
    },
    {
      label: t.profile.contact,
      icon: 'mail-outline',
      onPress: () => go('/info', { contentKey: 'contact' }),
    },
    {
      label: t.profile.privacy,
      icon: 'shield-outline',
      onPress: () => go('/info', { contentKey: 'privacy' }),
    },
    {
      label: t.profile.terms,
      icon: 'document-text-outline',
      onPress: () => go('/info', { contentKey: 'terms' }),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — tapping closes the panel */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Right-side panel */}
      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slideAnim }] }]}
      >
        <SafeAreaView edges={['top', 'bottom']} style={styles.panelInner}>

          {/* ── Close button ──────────────────────────────────────────────── */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={18} color={`${NAVY}50`} />
          </TouchableOpacity>

          {/* ── Brand + city ──────────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={styles.brandLabel}>✦ GOLDENBOOK</Text>
            {locality ? (
              <View style={styles.cityRow}>
                <Ionicons name="location-outline" size={12} color={GOLD} />
                <Text style={styles.cityName}>{locality.name}</Text>
                <Text style={styles.cityCountry}>{locality.country}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.ruleDivider} />

          {/* ── Utility ───────────────────────────────────────────────────── */}
          <View style={styles.sectionCard}>
            {utilityItems.map((item, i) => (
              <MenuRow key={item.label} item={item} isLast={i === utilityItems.length - 1} />
            ))}
          </View>

          {/* ── Information ───────────────────────────────────────────────── */}
          <Text style={styles.sectionLabel}>{t.menu.information}</Text>
          <View style={styles.sectionCard}>
            {infoItems.map((item, i) => (
              <MenuRow key={item.label} item={item} isLast={i === infoItems.length - 1} />
            ))}
          </View>

        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Modal overlay ─────────────────────────────────────────────────────────
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,45,82,0.38)',
  },

  // ── Panel ─────────────────────────────────────────────────────────────────
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: PANEL_WIDTH,
    backgroundColor: IVORY,
    shadowColor: NAVY,
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
  },
  panelInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // ── Close ─────────────────────────────────────────────────────────────────
  closeBtn: {
    alignSelf: 'flex-start',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(34,45,82,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    marginBottom: 16,
    gap: 8,
  },
  brandLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 3.5,
    color: `${GOLD}80`,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cityName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: NAVY,
    letterSpacing: -0.3,
  },
  cityCountry: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: `${NAVY}45`,
    letterSpacing: 0.1,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  ruleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(210,182,138,0.25)',
    marginBottom: 20,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    color: `${NAVY}35`,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${NAVY}0E`,
    overflow: 'hidden',
    marginBottom: 12,
  },

  // ── Menu row ──────────────────────────────────────────────────────────────
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: `${NAVY}07`,
    marginHorizontal: 14,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: `${NAVY}05`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: NAVY,
    letterSpacing: 0.1,
    flex: 1,
  },
});
