import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { ConciergeMessage } from '../types'

const GOLD  = '#D2B68A'
const NAVY  = '#222D52'
const IVORY = '#F9F7F2'

interface Props {
  message: ConciergeMessage
}

export function ConciergeMessageBubble({ message }: Props) {
  if (message.type === 'user_text') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    )
  }

  if (message.type === 'intent_selection') {
    return (
      <View style={styles.userRow}>
        <View style={styles.intentBubble}>
          <Text style={styles.intentText}>{message.text}</Text>
        </View>
      </View>
    )
  }

  // concierge_text or the lead-in text for recommendation_response
  return (
    <View style={styles.conciergeRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarMark}>✦</Text>
      </View>
      <View style={styles.conciergeBubble}>
        <Text style={styles.conciergeText}>{message.text}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // ── Concierge (left) ─────────────────────────────────────────────────────
  conciergeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarMark: {
    fontSize: 12,
    color: GOLD,
  },
  conciergeBubble: {
    flex: 1,
    backgroundColor: IVORY,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  conciergeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: NAVY,
    lineHeight: 22,
    letterSpacing: 0.1,
  },

  // ── User (right) ─────────────────────────────────────────────────────────
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  userBubble: {
    maxWidth: '74%',
    backgroundColor: NAVY,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  userText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: '#FDFDFB',
    lineHeight: 22,
  },

  // ── Intent selection (gold tint) ──────────────────────────────────────────
  intentBubble: {
    maxWidth: '74%',
    backgroundColor: 'rgba(210,182,138,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.45)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  intentText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: GOLD,
    letterSpacing: 0.2,
  },
})
