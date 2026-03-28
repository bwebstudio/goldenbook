import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { ConciergeIntentDTO } from '../types'

const GOLD = '#D2B68A'
const NAVY = '#222D52'

// Maps backend icon names → display characters
const ICON_MAP: Record<string, string> = {
  restaurant:   '◇',
  wine_bar:     '◈',
  music_note:   '♪',
  local_bar:    '◉',
  diamond:      '◆',
  coffee:       '○',
  wb_sunny:     '◌',
  shopping_bag: '□',
  museum:       '△',
  nightlife:    '☽',
}

interface Props {
  intent: ConciergeIntentDTO
  onPress: (intent: ConciergeIntentDTO) => void
  disabled?: boolean
}

export function ConciergeIntentCard({ intent, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.disabled]}
      onPress={() => onPress(intent)}
      activeOpacity={0.72}
      disabled={disabled}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{ICON_MAP[intent.icon] ?? '✦'}</Text>
      </View>

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{intent.title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{intent.subtitle}</Text>
      </View>

      {intent.label ? (
        <View style={styles.label}>
          <Text style={styles.labelText}>{intent.label}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDFDFB',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.22)',
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  disabled: { opacity: 0.45 },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(210,182,138,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 16,
    color: GOLD,
  },

  text: { flex: 1 },
  title: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(34,45,82,0.5)',
    lineHeight: 16,
  },

  label: {
    backgroundColor: 'rgba(210,182,138,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.38)',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  labelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
    color: GOLD,
    letterSpacing: 0.5,
  },
})
