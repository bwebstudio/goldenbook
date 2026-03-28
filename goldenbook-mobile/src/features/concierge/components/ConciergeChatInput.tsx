import React from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useTranslation } from '@/i18n'

const GOLD = '#D2B68A'
const NAVY = '#222D52'

interface Props {
  value: string
  onChangeText: (v: string) => void
  onSend: () => void
  loading?: boolean
}

export function ConciergeChatInput({ value, onChangeText, onSend, loading = false }: Props) {
  const t = useTranslation()
  const active = value.trim().length > 0 && !loading

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={t.concierge.askPlaceholder}
        placeholderTextColor="rgba(34,45,82,0.32)"
        returnKeyType="send"
        onSubmitEditing={active ? onSend : undefined}
        editable={!loading}
        maxLength={200}
        multiline={false}
      />
      <TouchableOpacity
        style={[styles.btn, !active && styles.btnDisabled]}
        onPress={onSend}
        disabled={!active}
        activeOpacity={0.75}
      >
        <Text style={styles.btnIcon}>{loading ? '…' : '→'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#F3EFE8',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.25)',
    paddingHorizontal: 18,
    paddingVertical: 4,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: NAVY,
    paddingVertical: 11,
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnDisabled: {
    backgroundColor: 'rgba(34,45,82,0.22)',
  },
  btnIcon: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: '#FDFDFB',
  },
})
