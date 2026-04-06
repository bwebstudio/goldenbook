// ─── Concierge Tab Screen ─────────────────────────────────────────────────────
//
// Conversational discovery layer for Goldenbook.
// All recommendations are fully deterministic and database-driven — no AI.
//
// Data flow:
//   mount → loadBootstrap() → backend returns greeting + 3 intent cards
//   intent tap → POST /concierge/recommend → recommendation cards
//   typed query → POST /concierge/recommend (backend resolves to intent)

import React, { useEffect, useRef } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  ConciergeMessageBubble,
  ConciergeRecommendationCard,
} from '@/features/concierge/components'
import { useConcierge } from '@/features/concierge/hooks/useConcierge'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/appStore'
import { useNowContextStore } from '@/store/nowContextStore'
import { useSettingsStore } from '@/store/settingsStore'
import type {
  ConciergeIntentDTO,
  ConciergeMessage,
} from '@/features/concierge/types'

const GOLD  = '#D2B68A'
const NAVY  = '#222D52'
const IVORY = '#FDFDFB'

/**
 * Build quick-option pills from dynamic backend data.
 *
 * Priority:
 *   1. fallbackIntents from the last recommendation (time-appropriate + city-viable)
 *   2. bootstrap intents (time-appropriate + city-viable, set on mount)
 *   3. static fallback (only if backend returned nothing)
 *
 * Max 4 pills shown. The resolved intent (currently active) is excluded
 * so the user always sees alternatives, not what they already picked.
 */
function buildQuickOptions(
  bootstrapIntents: ConciergeIntentDTO[] | undefined,
  lastFallbacks: { id: string; title: string }[] | undefined,
  activeIntentId: string | null,
  locale: string,
): ConciergeIntentDTO[] {
  // Merge: fallbacks first (most recent context), then bootstrap for variety
  const seen = new Set<string>()
  if (activeIntentId) seen.add(activeIntentId)
  const pills: ConciergeIntentDTO[] = []

  // Add fallbackIntents from last recommendation
  if (lastFallbacks?.length) {
    for (const fb of lastFallbacks) {
      if (seen.has(fb.id) || pills.length >= 4) continue
      seen.add(fb.id)
      pills.push({ id: fb.id, title: fb.title, subtitle: '', icon: '', label: null })
    }
  }

  // Fill from bootstrap intents
  if (bootstrapIntents?.length) {
    for (const bi of bootstrapIntents) {
      if (seen.has(bi.id) || pills.length >= 4) continue
      seen.add(bi.id)
      pills.push(bi)
    }
  }

  // Static fallback only if nothing from backend
  if (pills.length === 0) {
    const lang = locale.split('-')[0]
    return lang === 'pt'
      ? [
          { id: 'hidden_gems', title: 'Lugares secretos', subtitle: '', icon: 'diamond', label: null },
          { id: 'relaxed_walk', title: 'Passeio tranquilo', subtitle: '', icon: 'directions_walk', label: null },
        ]
      : lang === 'es'
        ? [
            { id: 'hidden_gems', title: 'Lugares secretos', subtitle: '', icon: 'diamond', label: null },
            { id: 'relaxed_walk', title: 'Paseo tranquilo', subtitle: '', icon: 'directions_walk', label: null },
          ]
        : [
            { id: 'hidden_gems', title: 'Hidden gems', subtitle: '', icon: 'diamond', label: null },
            { id: 'relaxed_walk', title: 'Relaxed stroll', subtitle: '', icon: 'directions_walk', label: null },
          ]
  }

  return pills
}

export default function ConciergeScreen() {
  const { state, loadBootstrap, loadFromNowContext, handleIntentTap } = useConcierge()
  const t = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const pendingNowContext = useNowContextStore((s) => s.pending)
  const router = useRouter()
  const { entry } = useLocalSearchParams<{ entry?: string }>()

  const scrollRef = useRef<ScrollView>(null)
  const entryOpacity = useRef(new Animated.Value(entry === 'now' ? 0 : 1)).current
  const entryTranslateY = useRef(new Animated.Value(entry === 'now' ? 14 : 0)).current

  // Pills are fixed for the session — always use bootstrap intents.
  // This gives the user a stable menu to navigate, not a moving target.
  const quickOptions = buildQuickOptions(
    state.bootstrapData?.intents,
    undefined,
    null,
    locale,
  )

  // Load bootstrap on mount, city change, or locale change
  const city = useAppStore((s) => s.selectedCity)
  const bootstrapCity = state.bootstrapData?.city.slug
  useEffect(() => {
    if (entry === 'now') return
    // Reload if no bootstrap or if city changed since last bootstrap
    if (!state.bootstrapData || (bootstrapCity && bootstrapCity !== city)) {
      loadBootstrap()
    }
  }, [entry, loadBootstrap, state.bootstrapData, bootstrapCity, city])

  useEffect(() => {
    if (entry !== 'now' || pendingNowContext?.source !== 'now') return
    loadFromNowContext()
  }, [entry, pendingNowContext, loadFromNowContext])

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    if (state.messages.length > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
      return () => clearTimeout(t)
    }
  }, [state.messages.length, state.loadingRecommendation])

  useEffect(() => {
    if (entry !== 'now') return

    entryOpacity.setValue(0)
    entryTranslateY.setValue(14)

    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(entryTranslateY, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.setParams({ entry: undefined })
    })
  }, [entry, entryOpacity, entryTranslateY, router])

  // ── Loading bootstrap ──────────────────────────────────────────────────────
  if (state.loadingBootstrap) {
    return (
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: entryOpacity,
            transform: [{ translateY: entryTranslateY }],
          },
        ]}
      >
        <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
          <ActivityIndicator size="large" color={GOLD} />
          <Text style={styles.loadingText}>{t.concierge.preparingGuide}</Text>
        </SafeAreaView>
      </Animated.View>
    )
  }

  // ── Bootstrap error ────────────────────────────────────────────────────────
  if (state.error && state.messages.length === 0) {
    return (
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: entryOpacity,
            transform: [{ translateY: entryTranslateY }],
          },
        ]}
      >
        <SafeAreaView style={styles.errorScreen} edges={['top', 'bottom']}>
          <View style={styles.errorBody}>
            <Text style={styles.errorMark}>✦</Text>
            <Text style={styles.errorTitle}>{t.concierge.unableToConnect}</Text>
            <Text style={styles.errorSub}>
              {t.concierge.unavailableSub}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadBootstrap} activeOpacity={0.8}>
              <Text style={styles.retryText}>{t.concierge.tryAgain}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    )
  }

  // ── Main screen ────────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        styles.flex,
        {
          opacity: entryOpacity,
          transform: [{ translateY: entryTranslateY }],
        },
      ]}
    >
      <SafeAreaView style={styles.root} edges={['top']}>
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t.concierge.title.toUpperCase()}</Text>
            <Text style={styles.headerSub}>{t.concierge.personalGuide.toUpperCase()}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.avatar}>
              <Text style={styles.avatarMark}>✦</Text>
            </View>
          </View>
        </View>

        {/* ── Chat + Input ───────────────────────────────────────────────────── */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {state.messages.map((msg) => (
              <MessageBlock
                key={msg.id}
                message={msg}
              />
            ))}

            {/* Thinking indicator while waiting for recommendations */}
            {state.loadingRecommendation && (
              <View style={styles.thinkingRow}>
                <View style={styles.thinkingAvatar}>
                  <Text style={styles.thinkingMark}>✦</Text>
                </View>
                <View style={styles.thinkingBubble}>
                  <Text style={styles.thinkingDots}>· · ·</Text>
                </View>
              </View>
            )}

            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Intent pills */}
          <View style={styles.inputWrap}>
            <View style={styles.quickOptionsWrap}>
              {quickOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.quickOptionChip}
                  onPress={() => handleIntentTap(option)}
                  disabled={state.loadingRecommendation}
                  activeOpacity={0.74}
                >
                  <Text style={styles.quickOptionText}>{option.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <SafeAreaView edges={['bottom']} style={styles.bottomSafe} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  )
}

// ─── MessageBlock ─────────────────────────────────────────────────────────────
// Renders one message and all UI associated with it below it:
// intent cards (for the initial greeting), recommendation cards, fallback chips.

interface MessageBlockProps {
  message: ConciergeMessage
}

function MessageBlock({
  message,
}: MessageBlockProps) {
  const t = useTranslation()
  return (
    <View>
      {/* Text bubble */}
      {(message.type !== 'recommendation_response' || message.text) && (
        <ConciergeMessageBubble message={message} />
      )}

      {/* Recommendation cards */}
      {message.type === 'recommendation_response' &&
        message.recommendations &&
        message.recommendations.length > 0 && (
          <View style={styles.recoSection}>
            {/* Primary — full cinematic card */}
            <ConciergeRecommendationCard recommendation={message.recommendations[0]} />
            {/* Secondary — compact horizontal cards */}
            {message.recommendations.slice(1).map((r) => (
              <ConciergeRecommendationCard key={r.id} recommendation={r} compact />
            ))}
          </View>
        )}

      {/* Empty results message */}
      {message.type === 'recommendation_response' &&
        message.recommendations?.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {t.concierge.noMatchText}
            </Text>
          </View>
        )}

    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: IVORY },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(253,253,251,0.96)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(210,182,138,0.3)',
  },
  headerLeft: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: NAVY,
    letterSpacing: 5,
  },
  headerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: GOLD,
    letterSpacing: 3.5,
    marginTop: 2,
  },
  headerRight: { width: 40, alignItems: 'flex-end' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMark: { fontSize: 11, color: GOLD },

  // ── Scroll ──────────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20, paddingBottom: 8 },

  // ── Recommendation section ────────────────────────────────────────────────
  recoSection: { marginBottom: 8 },

  // ── Thinking indicator ────────────────────────────────────────────────────
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  thinkingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  thinkingMark: { fontSize: 12, color: GOLD },
  thinkingBubble: {
    backgroundColor: '#F3EFE8',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  thinkingDots: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: GOLD,
    letterSpacing: 4,
  },

  // ── Empty results ─────────────────────────────────────────────────────────
  emptyBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#F9F7F2',
    borderRadius: 12,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: NAVY,
    lineHeight: 20,
  },

  // ── Input area ────────────────────────────────────────────────────────────
  inputWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(210,182,138,0.25)',
    paddingTop: 14,
    backgroundColor: IVORY,
  },
  quickOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 24,
    marginTop: -2,
    marginBottom: 12,
  },
  quickOptionChip: {
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(34,45,82,0.12)',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickOptionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(34,45,82,0.72)',
  },

  // ── Loading / Error screens ───────────────────────────────────────────────
  centered: {
    flex: 1,
    backgroundColor: IVORY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(34,45,82,0.45)',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  errorScreen: { flex: 1, backgroundColor: IVORY },
  errorBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorMark: { fontSize: 28, color: GOLD, marginBottom: 20 },
  errorTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: NAVY,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: 'rgba(34,45,82,0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  retryBtn: {
    backgroundColor: NAVY,
    borderRadius: 9999,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  retryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FDFDFB',
    letterSpacing: 0.5,
  },
  bottomSafe: { backgroundColor: IVORY },
})
