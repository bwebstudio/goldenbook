import { router } from 'expo-router'
import React from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
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

  return (
    <View style={styles.card}>
      {/* Hero image */}
      <View style={styles.imageContainer}>
        <ProgressiveImage
          uri={getStorageUrl(recommendation.heroImage.bucket, recommendation.heroImage.path)}
          aspectRatio={16 / 10}
          borderRadius={0}
        />
        {/* Overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.overlay} />
        </View>
        {/* Badges */}
        {recommendation.badges.length > 0 && (
          <View style={styles.badges}>
            {recommendation.badges.slice(0, 2).map((b) => (
              <View key={b} style={styles.badge}>
                <Text style={styles.badgeText}>{b.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}
        {/* City */}
        <Text style={styles.city}>
          {[recommendation.city, recommendation.neighborhood].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name}>{recommendation.name}</Text>
        {recommendation.shortDescription ? (
          <Text style={styles.description} numberOfLines={3}>
            {recommendation.shortDescription}
          </Text>
        ) : null}
        <TouchableOpacity style={styles.cta} onPress={handlePress} activeOpacity={0.82}>
          <Text style={styles.ctaText}>{t.concierge.requestAccess}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // ── Primary card ──────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: '#FDFDFB',
    overflow: 'hidden',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,45,82,0.35)',
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
  city: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
  },
  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: NAVY,
    marginBottom: 8,
    lineHeight: 26,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: 'rgba(34,45,82,0.6)',
    lineHeight: 20,
    marginBottom: 18,
  },
  cta: {
    backgroundColor: NAVY,
    borderRadius: 9999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#FDFDFB',
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
