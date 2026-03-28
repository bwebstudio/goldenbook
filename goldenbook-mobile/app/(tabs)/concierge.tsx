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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  ConciergeChatInput,
  ConciergeIntentCard,
  ConciergeMessageBubble,
  ConciergeRecommendationCard,
} from '@/features/concierge/components'
import { useConcierge } from '@/features/concierge/hooks/useConcierge'
import { useTranslation } from '@/i18n'
import type {
  ConciergeIntentDTO,
  ConciergeMessage,
} from '@/features/concierge/types'

const GOLD  = '#D2B68A'
const NAVY  = '#222D52'
const IVORY = '#FDFDFB'

export default function ConciergeScreen() {
  const { state, loadBootstrap, handleIntentTap, handleSend, handleFallbackTap, setInput } =
    useConcierge()
  const t = useTranslation()

  const scrollRef = useRef<ScrollView>(null)

  // Load bootstrap on mount and whenever locale changes
  useEffect(() => {
    loadBootstrap()
  }, [loadBootstrap])

  // Auto-scroll to bottom on new messages or loading state change
  useEffect(() => {
    if (state.messages.length > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
      return () => clearTimeout(t)
    }
  }, [state.messages.length, state.loadingRecommendation])

  // ── Loading bootstrap ──────────────────────────────────────────────────────
  if (state.loadingBootstrap) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={styles.loadingText}>{t.concierge.preparingGuide}</Text>
      </SafeAreaView>
    )
  }

  // ── Bootstrap error ────────────────────────────────────────────────────────
  if (state.error && state.messages.length === 0) {
    return (
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
    )
  }

  // ── Main screen ────────────────────────────────────────────────────────────
  return (
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
          {state.messages.map((msg, idx) => (
            <MessageBlock
              key={msg.id}
              message={msg}
              bootstrapIntents={
                idx === 0 && state.bootstrapData ? state.bootstrapData.intents : []
              }
              onIntentTap={handleIntentTap}
              onFallbackTap={handleFallbackTap}
              intentsDisabled={state.loadingRecommendation}
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

        {/* Input bar */}
        <View style={styles.inputWrap}>
          <ConciergeChatInput
            value={state.inputValue}
            onChangeText={setInput}
            onSend={handleSend}
            loading={state.loadingRecommendation}
          />
        </View>
        <SafeAreaView edges={['bottom']} style={styles.bottomSafe} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── MessageBlock ─────────────────────────────────────────────────────────────
// Renders one message and all UI associated with it below it:
// intent cards (for the initial greeting), recommendation cards, fallback chips.

interface MessageBlockProps {
  message: ConciergeMessage
  bootstrapIntents: ConciergeIntentDTO[]
  onIntentTap: (intent: ConciergeIntentDTO) => void
  onFallbackTap: (intent: { id: string; title: string }) => void
  intentsDisabled: boolean
}

function MessageBlock({
  message,
  bootstrapIntents,
  onIntentTap,
  onFallbackTap,
  intentsDisabled,
}: MessageBlockProps) {
  const t = useTranslation()
  return (
    <View>
      {/* Text bubble */}
      {(message.type !== 'recommendation_response' || message.text) && (
        <ConciergeMessageBubble message={message} />
      )}

      {/* Bootstrap intent cards — only below the first concierge greeting */}
      {bootstrapIntents.length > 0 && (
        <View style={styles.intentSection}>
          {bootstrapIntents.map((intent) => (
            <ConciergeIntentCard
              key={intent.id}
              intent={intent}
              onPress={onIntentTap}
              disabled={intentsDisabled}
            />
          ))}
        </View>
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

      {/* Fallback intent chips */}
      {message.type === 'recommendation_response' &&
        message.fallbackIntents &&
        message.fallbackIntents.length > 0 && (
          <View style={styles.fallbackSection}>
            <Text style={styles.fallbackLabel}>{t.concierge.youMightAlsoEnjoy}</Text>
            <View style={styles.fallbackChips}>
              {message.fallbackIntents.map((fi) => (
                <TouchableOpacity
                  key={fi.id}
                  style={styles.chip}
                  onPress={() => onFallbackTap(fi)}
                  disabled={intentsDisabled}
                  activeOpacity={0.72}
                >
                  <Text style={styles.chipText}>{fi.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
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

  // ── Intent section ───────────────────────────────────────────────────────────
  intentSection: { marginTop: 4, marginBottom: 14 },

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

  // ── Fallback chips ────────────────────────────────────────────────────────
  fallbackSection: { marginHorizontal: 20, marginBottom: 16 },
  fallbackLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: 'rgba(34,45,82,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fallbackChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: 'rgba(210,182,138,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.35)',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: GOLD,
    letterSpacing: 0.3,
  },

  // ── Input area ────────────────────────────────────────────────────────────
  inputWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(210,182,138,0.25)',
    paddingTop: 10,
    backgroundColor: IVORY,
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
