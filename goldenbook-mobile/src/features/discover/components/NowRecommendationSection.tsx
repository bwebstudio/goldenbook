import { View, Text, TouchableOpacity, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { getStorageUrl } from '@/utils/storage'
import { ProgressiveImage } from '@/components/ui/ProgressiveImage'
import { getClientTimeSegment } from '../utils/getNowRecommendation'
import { useTranslation } from '@/i18n'
import type { NowRecommendation } from '@/types/api'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_HEIGHT = SCREEN_HEIGHT * 0.48

interface NowRecommendationSectionProps {
  now: NowRecommendation
  cityName: string
}

export function NowRecommendationSection({ now, cityName }: NowRecommendationSectionProps) {
  const router = useRouter()
  const t = useTranslation()

  const liveSegment = getClientTimeSegment()
  const city = cityName

  // Build locale-aware copy from translation keys
  const eyebrowMap = {
    morning:   `${t.now.eyebrowMorning} ${city.toUpperCase()}`,
    midday:    `${t.now.eyebrowMidday} ${city.toUpperCase()}`,
    afternoon: t.now.eyebrowAfternoon,
    evening:   `${t.now.eyebrowEvening} ${city.toUpperCase()}`,
    night:     `${t.now.eyebrowNight} ${city.toUpperCase()}`,
  }
  const headlineMap = {
    morning:   t.now.headlineMorning,
    midday:    `${t.now.headlineMidday} ${city}`,
    afternoon: t.now.headlineAfternoon,
    evening:   t.now.headlineEvening,
    night:     t.now.headlineNight,
  }
  const supportingMap = {
    morning:   t.now.supportingMorning,
    midday:    t.now.supportingMidday,
    afternoon: t.now.supportingAfternoon,
    evening:   t.now.supportingEvening,
    night:     t.now.supportingNight,
  }

  const eyebrow       = eyebrowMap[liveSegment]
  const headline      = headlineMap[liveSegment]
  const supportingText = supportingMap[liveSegment]

  const imageUrl = getStorageUrl(now.image.bucket, now.image.path)

  const handlePress = () => {
    router.push(`/places/${now.slug}` as any)
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.96}
      className="mx-6 rounded-2xl overflow-hidden"
      style={{
        height: CARD_HEIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
        elevation: 10,
      }}
    >
      {/* Background image */}
      <ProgressiveImage
        uri={imageUrl}
        height={CARD_HEIGHT}
        resizeMode="cover"
        borderRadius={16}
        placeholderColor="#222D52"
        style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      />

      {/* Dark base overlay for contrast */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 16,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }}
        pointerEvents="none"
      />

      {/* Goldenbook blue gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          'transparent',
          'rgba(17,35,67,0.55)',
          'rgba(17,35,67,0.88)',
        ]}
        locations={[0, 0.28, 0.62, 1]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 16,
        }}
        pointerEvents="none"
      />

      {/* Content overlay */}
      <View className="absolute bottom-0 left-0 right-0 p-7">

        {/* 1. Eyebrow — contextual label, NOT editorial */}
        <View className="flex-row items-center mb-3">
          <View
            style={{ width: 20, height: 1, backgroundColor: '#D2B68A', marginRight: 8 }}
          />
          <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
            {eyebrow}
          </Text>
        </View>

        {/* 2. Contextual headline — describes the moment, not the place */}
        <Text
          className="text-white text-2xl leading-snug mb-2"
          style={{
            fontFamily: 'PlayfairDisplay_400Regular_Italic',
            maxWidth: SCREEN_WIDTH * 0.72,
          }}
          numberOfLines={2}
        >
          {headline}
        </Text>

        {/* 3. Supporting metadata */}
        <Text
          className="text-white/60 text-[11px] tracking-wide mb-4"
          numberOfLines={1}
        >
          {supportingText}
        </Text>

        {/* 4. Venue name — always clearly visible, separate from headline */}
        <Text
          className="text-white text-base font-bold tracking-wide mb-5"
          numberOfLines={1}
          style={{ maxWidth: SCREEN_WIDTH * 0.65 }}
        >
          {now.name}
        </Text>

        {/* 5. CTA */}
        <View className="flex-row">
          <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.85}
            className="bg-primary rounded-lg px-5 py-3 items-center justify-center"
          >
            <Text className="text-navy text-[10px] uppercase tracking-widest font-bold">
              {t.discover.exploreNow}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
}
