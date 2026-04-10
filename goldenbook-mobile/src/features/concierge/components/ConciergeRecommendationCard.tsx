import { router } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ProgressiveImage } from '@/components/ui/ProgressiveImage'
import { getStorageUrl } from '@/utils/storage'
import { useTranslation } from '@/i18n'
import type { ConciergeRecommendationDTO } from '../types'

const GOLD = '#D2B68A'
const NAVY = '#222D52'

interface Props {
  recommendation: ConciergeRecommendationDTO
  /** Compact variant for 2nd/3rd results */
  compact?: boolean
}

export function ConciergeRecommendationCard({ recommendation, compact = false }: Props) {
  const t = useTranslation()
  const handlePress = () => {
    // Navigate to place detail using slug.
    // V2 TODO: once EstablishmentScreen is migrated to slug-based lookup, this
    // will work end-to-end. Currently falls through to place-detail by slug.
    router.push(`/places/${recommendation.slug}`)
  }

  if (compact) {
    return (
      <TouchableOpacity style={styles.compact} onPress={handlePress} activeOpacity={0.8}>
        <ProgressiveImage
          uri={getStorageUrl(recommendation.heroImage.bucket, recommendation.heroImage.path)}
          height={72}
          borderRadius={10}
          style={styles.compactImage}
        />
        <View style={styles.compactText}>
          <Text style={styles.compactCity} numberOfLines={1}>
            {[recommendation.city, recommendation.neighborhood].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.compactName} numberOfLines={1}>{recommendation.name}</Text>
          {recommendation.shortDescription ? (
            <Text style={styles.compactDesc} numberOfLines={2}>{recommendation.shortDescription}</Text>
          ) : null}
        </View>
        <Text style={styles.compactArrow}>→</Text>
      </TouchableOpacity>
    )
  }

  const CARD_HEIGHT = 340

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.92} style={[styles.card, { height: CARD_HEIGHT }]}>
      {/* Full-bleed hero image */}
      <ProgressiveImage
        uri={getStorageUrl(recommendation.heroImage.bucket, recommendation.heroImage.path)}
        height={CARD_HEIGHT}
        borderRadius={0}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Multi-stop gradient overlay (Apple TV style) */}
      <LinearGradient
        colors={[
          'transparent',
          'rgba(17,24,40,0.08)',
          'rgba(17,24,40,0.35)',
          'rgba(17,24,40,0.70)',
          'rgba(17,24,40,0.90)',
          'rgba(17,24,40,0.97)',
        ]}
        locations={[0, 0.2, 0.38, 0.56, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Badges (top-left) */}
      {recommendation.badges.length > 0 && (
        <View style={styles.badges}>
          {recommendation.badges.slice(0, 2).map((b) => (
            <View key={b} style={styles.badge}>
              <Text style={styles.badgeText}>{b.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Content — positioned over gradient */}
      <View style={styles.contentOverlay}>
        {/* City */}
        <Text style={styles.cityOverlay}>
          {[recommendation.city, recommendation.neighborhood].filter(Boolean).join(' · ')}
        </Text>

        <Text style={styles.nameOverlay}>{recommendation.name}</Text>
        {recommendation.shortDescription ? (
          <Text style={styles.descriptionOverlay} numberOfLines={2}>
            {recommendation.shortDescription}
          </Text>
        ) : null}
        <View style={styles.ctaOverlay}>
          <Text style={styles.ctaText}>{t.concierge.requestAccess}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // ── Primary card ──────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 10,
  },
  badges: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(34,45,82,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.4)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 8,
    color: GOLD,
    letterSpacing: 1,
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 12,
  },
  cityOverlay: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: GOLD,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameOverlay: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  descriptionOverlay: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ctaOverlay: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: NAVY,
    letterSpacing: 0.8,
  },

  // ── Compact card ──────────────────────────────────────────────────────────
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: '#FDFDFB',
    borderWidth: 1,
    borderColor: 'rgba(210,182,138,0.18)',
    borderRadius: 14,
    overflow: 'hidden',
    paddingRight: 14,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  compactImage: {
    width: 72,
    flexShrink: 0,
  },
  compactText: {
    flex: 1,
    paddingVertical: 12,
  },
  compactCity: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
    color: 'rgba(34,45,82,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  compactName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: NAVY,
    marginBottom: 3,
  },
  compactDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(34,45,82,0.5)',
    lineHeight: 15,
  },
  compactArrow: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: GOLD,
    flexShrink: 0,
  },
})
