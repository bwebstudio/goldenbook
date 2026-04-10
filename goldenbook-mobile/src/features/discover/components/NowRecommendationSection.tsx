import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { getStorageUrl } from '@/utils/storage'
import { ProgressiveImage } from '@/components/ui/ProgressiveImage'
import { useTranslation } from '@/i18n'
import { useNowRecommendation, type NowEmotion } from '../hooks/useNowRecommendation'
import { useAppStore } from '@/store/appStore'
import { useNowContextStore, type NowAdjustment } from '@/store/nowContextStore'
import { useSettingsStore } from '@/store/settingsStore'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_HEIGHT = SCREEN_HEIGHT * 0.38

// ─── Weather → Ionicons vector icon ─────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const WEATHER_DAY_ICONS: Record<string, { name: IoniconsName; color: string }> = {
  sun:   { name: 'sunny-outline',        color: '#F5C542' },
  cloud: { name: 'cloudy-outline',       color: '#CFD8DC' },
  rain:  { name: 'rainy-outline',        color: '#90CAF9' },
}

const WEATHER_NIGHT_ICONS: Record<string, { name: IoniconsName; color: string }> = {
  sun:   { name: 'moon-outline',         color: '#C5CAE9' },
  cloud: { name: 'cloudy-night-outline', color: '#9EA7B8' },
  rain:  { name: 'rainy-outline',        color: '#90CAF9' },
}

const WEATHER_CONDITION_TO_KEY: Record<string, string> = {
  sunny: 'sun', cloudy: 'cloud', rainy: 'rain', hot: 'sun', cold: 'cloud',
}

function isNightTime(timeZone: string): boolean {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(new Date()),
    10,
  )
  return hour >= 21 || hour < 6
}

function getWeatherIcon(key: string | null, timeZone: string): { name: IoniconsName; color: string } | null {
  if (!key) return null
  const map = isNightTime(timeZone) ? WEATHER_NIGHT_ICONS : WEATHER_DAY_ICONS
  return map[key] ?? null
}

// ─── Live clock ──────────────────────────────────────────────────────────────

function useLiveClock(timeZone: string, locale: string): string {
  const [time, setTime] = useState(() => formatNow(timeZone, locale))

  useEffect(() => {
    setTime(formatNow(timeZone, locale))
    const interval = setInterval(() => setTime(formatNow(timeZone, locale)), 60_000)
    return () => clearInterval(interval)
  }, [timeZone, locale])

  return time
}

function formatNow(timeZone: string, locale: string): string {
  const localeTag =
    locale === 'pt'
      ? 'pt-PT'
      : locale === 'es'
        ? 'es-ES'
        : 'en-US'

  return new Intl.DateTimeFormat(localeTag, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date())
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NowRecommendationSectionProps {
  cityName: string
}

interface AdjustmentConfig {
  label: string
  value: NowAdjustment
}

export function NowRecommendationSection({ cityName }: NowRecommendationSectionProps) {
  const router = useRouter()
  const t = useTranslation()
  const locale = useSettingsStore((s) => s.locale)
  const citySlug = useAppStore((s) => s.selectedCity)
  const { data, loading, refreshing, error, refresh, reload } = useNowRecommendation()
  const setNowContext = useNowContextStore((s) => s.set)
  const destinationTimeZone = getTimeZoneForCity(data?.place?.city || cityName)
  const liveTime = useLiveClock(destinationTimeZone, locale)

  // ── Navigate to Concierge with context ─────────────────────────────────────

  const navigateToConcierge = useCallback((adjustment?: NowAdjustment) => {
    if (!data?.place || !data.context) {
      router.push({ pathname: '/concierge', params: { entry: 'now' } } as any)
      return
    }
    setNowContext({
      city: citySlug,
      time_of_day: data.context.time_of_day,
      weather: data.context.weather,
      moment: data.context.moment,
      moment_label: data.context.moment_label,
      source: 'now',
      adjustment,
    })
    router.push({ pathname: '/concierge', params: { entry: 'now' } } as any)
  }, [data, setNowContext, router])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View
        className="mx-6 rounded-2xl overflow-hidden items-center justify-center"
        style={{ height: CARD_HEIGHT * 0.5, backgroundColor: '#222D52' }}
      >
        <ActivityIndicator size="small" color="#D2B68A" />
      </View>
    )
  }

  // ── Fallback: error or no place → editorial destination card ───────────────
  // This section NEVER disappears. If there's no geo recommendation,
  // we show a destination-based editorial card so the section stays alive.
  if (error || !data?.place) {
    return (
      <NowEditorialFallback
        cityName={cityName}
        liveTime={liveTime}
        t={t}
        isError={error}
        onRetry={reload}
        onConcierge={() => navigateToConcierge()}
      />
    )
  }

  // ── Normal recommendation card ─────────────────────────────────────────────

  const { place, title, subtitle, context, isSponsored } = data
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path)

  const weatherKey = context.weather_icon
    ?? (context.weather ? WEATHER_CONDITION_TO_KEY[context.weather] : null)
  const weatherIcon = getWeatherIcon(weatherKey, destinationTimeZone)

  // Build eyebrow: specific descriptor + location
  // Priority: cuisineType > subcategory > category label
  const CATEGORY_LABELS: Record<string, string> = {
    restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', hotel: 'Hotel',
    museum: 'Museum', shop: 'Shop', landmark: 'Landmark', beach: 'Beach',
    activity: 'Experience', venue: 'Venue',
  }
  const CUISINE_LABELS: Record<string, string> = {
    portuguese: 'Portuguese', seafood: 'Seafood', italian: 'Italian',
    japanese: 'Japanese', french: 'French', mediterranean: 'Mediterranean',
    'fine-dining': 'Fine Dining', indian: 'Indian', chinese: 'Chinese',
    mexican: 'Mexican', thai: 'Thai', sushi: 'Sushi', steak: 'Steakhouse',
    fusion: 'Fusion', vegetarian: 'Vegetarian', vegan: 'Vegan',
  }
  const SUBCATEGORY_LABELS: Record<string, string> = {
    joalharia: 'Jewellery', relojoaria: 'Watches', moda: 'Fashion',
    perfumaria: 'Perfumery', decoracao: 'Design', arte: 'Art',
    vinhos: 'Wine', gourmet: 'Gourmet', livros: 'Books',
  }
  const descriptor =
    (place.cuisineType && CUISINE_LABELS[place.cuisineType]) ??
    (place.subcategory && SUBCATEGORY_LABELS[place.subcategory]) ??
    CATEGORY_LABELS[place.category] ?? place.category
  const location = place.neighborhood ?? cityName
  const eyebrow = `${descriptor.toUpperCase()} \u00B7 ${location.toUpperCase()}`
  const adjustmentButtons = getAdjustmentButtons(data.emotion, t.now as any)

  return (
    <View>
      <TouchableOpacity
        onPress={() => router.push(`/places/${place.slug}` as any)}
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
        {/* Full-bleed hero image */}
        <ProgressiveImage
          uri={imageUrl}
          height={CARD_HEIGHT}
          resizeMode="cover"
          placeholderColor="#222D52"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Multi-stop gradient overlay (Apple TV style) */}
        <LinearGradient
          colors={[
            'transparent',
            'rgba(17,24,40,0.08)',
            'rgba(17,24,40,0.35)',
            'rgba(17,24,40,0.72)',
            'rgba(17,24,40,0.92)',
            'rgba(17,24,40,0.98)',
          ]}
          locations={[0, 0.25, 0.4, 0.58, 0.75, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          pointerEvents="none"
        />

        {/* Context pill (top-right) */}
        <View
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(22,30,56,0.70)',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 6,
          }}
        >
          {weatherIcon ? (
            <Ionicons name={weatherIcon.name} size={12} color={weatherIcon.color} />
          ) : null}
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.6 }}>
            {liveTime}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {cityName}
          </Text>
        </View>

        {/* Sponsored label (top-left, subtle) */}
        {isSponsored && (
          <View style={{ position: 'absolute', top: 14, left: 14 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, letterSpacing: 0.3 }}>
              {t.common.sponsoredGoldenbook}
            </Text>
          </View>
        )}

        {/* Text zone — positioned over gradient for guaranteed contrast */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12 }}>
          <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
            <View style={{ width: 20, height: 1, backgroundColor: '#D2B68A', marginRight: 4 }} />
            <Text
              className="text-[9px] uppercase tracking-widest font-bold"
              style={{ color: '#D2B68A', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
            >
              {eyebrow}
            </Text>
          </View>

          <Text
            className="text-white text-xl leading-snug mb-1"
            style={{
              fontFamily: 'PlayfairDisplay_400Regular_Italic',
              maxWidth: Math.max(240, SCREEN_WIDTH * 0.72),
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text
              className="text-[11px] tracking-wide mb-3 leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.6)', textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : (
            <View className="mb-3" />
          )}

          <Text
            className="text-white text-sm font-bold tracking-wide mb-4"
            numberOfLines={1}
            style={{
              maxWidth: Math.max(200, SCREEN_WIDTH * 0.65),
              textShadowColor: 'rgba(0,0,0,0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {place.name}
          </Text>

          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => router.push(`/places/${place.slug}` as any)}
              activeOpacity={0.85}
              className="bg-primary rounded-lg px-5 py-3 items-center justify-center"
            >
              <Text className="text-navy text-[10px] uppercase tracking-widest font-bold">
                {(t.now as any).exploreNow ?? (t.discover as any).exploreNow}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Actions below the card ────────────────────────────────────────── */}
      <View className="mx-6 mt-3 mb-1" style={{ gap: 6 }}>

        {/* See another option */}
        <TouchableOpacity
          onPress={refresh}
          disabled={refreshing}
          activeOpacity={0.7}
          className="flex-row items-center justify-center py-2"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color="#D2B68A" />
          ) : (
            <Text className="text-primary text-[11px] tracking-wide font-semibold">
              {(t.now as any).seeAnother}
            </Text>
          )}
        </TouchableOpacity>

        {/* Looking for something else? → Concierge */}
        <TouchableOpacity
          onPress={() => navigateToConcierge()}
          activeOpacity={0.7}
          className="flex-row items-center justify-center py-1"
          style={{ gap: 6 }}
        >
          <Text className="text-navy/30 text-[10px] tracking-wide">
            {(t.now as any).lookingForMore}
          </Text>
          <Text className="text-primary text-[10px] tracking-wide font-semibold">
            {(t.now as any).openConcierge} →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Editorial fallback card ────────────────────────────────────────────────
// Shown when the NOW API fails, returns no place, or user is outside coverage.
// Uses destination-based editorial copy so the section never feels broken.

interface NowEditorialFallbackProps {
  cityName: string
  liveTime: string
  t: any
  isError?: boolean
  onRetry: () => void
  onConcierge: () => void
}

function NowEditorialFallback({ cityName, liveTime, t, isError = false, onRetry, onConcierge }: NowEditorialFallbackProps) {
  const timeSegment = getClientTimeSegment()
  const headlineKey = `headline${capitalize(timeSegment)}`
  // When the API actually errored, use the error copy so users understand
  // why the section is in fallback mode. Otherwise show the time-of-day
  // editorial headline as a soft fallback.
  const headline: string = isError
    ? ((t.now as any).errorLoading ?? t.now.headlineMorning)
    : ((t.now as any)[headlineKey] ?? t.now.headlineMorning)

  return (
    <View>
      <TouchableOpacity
        onPress={onConcierge}
        activeOpacity={0.96}
        className="mx-6 rounded-2xl overflow-hidden"
        style={{
          height: SCREEN_HEIGHT * 0.28,
          backgroundColor: '#222D52',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={['rgba(34,45,82,0.95)', 'rgba(17,35,67,1)']}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 16,
          }}
          pointerEvents="none"
        />

        {/* Context pill (top-right) */}
        <View
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 6,
            gap: 6,
          }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, fontWeight: '600', letterSpacing: 0.6 }}>
            {liveTime}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.25)' }} />
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {cityName}
          </Text>
        </View>

        {/* Content */}
        <View className="absolute bottom-0 left-0 right-0 p-7">
          <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
            <View style={{ width: 20, height: 1, backgroundColor: '#D2B68A', marginRight: 4 }} />
            <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
              {t.now.editorialEyebrow ?? `${t.discover.goldenbookRecommendation.toUpperCase()}`}
            </Text>
          </View>

          <Text
            className="text-white text-xl leading-snug mb-4"
            style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic', maxWidth: Math.max(240, SCREEN_WIDTH * 0.72) }}
            numberOfLines={2}
          >
            {headline}
          </Text>

          <View className="flex-row" style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={onConcierge}
              activeOpacity={0.85}
              className="bg-primary rounded-lg px-5 py-3 items-center justify-center"
            >
              <Text className="text-navy text-[10px] uppercase tracking-widest font-bold">
                {(t.now as any).openConcierge}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRetry}
              activeOpacity={0.7}
              className="rounded-lg px-4 py-3 items-center justify-center"
              style={{ borderWidth: 1, borderColor: 'rgba(210,182,138,0.3)' }}
            >
              <Text className="text-primary text-[10px] uppercase tracking-widest font-medium">
                {t.common.retry}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  )
}

// ─── Adjustment pill button ──────────────────────────────────────────────────

function AdjustmentPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        borderWidth: 1,
        borderColor: 'rgba(17,35,67,0.14)',
        borderRadius: 16,
        backgroundColor: 'transparent',
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: 'rgba(17,35,67,0.58)', fontSize: 9, fontWeight: '500', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

function getAdjustmentButtons(
  emotion: NowEmotion | null | undefined,
  nowCopy: { adjustRelax?: string; adjustEnergy?: string; adjustTreat?: string },
): AdjustmentConfig[] {
  const labelRelax = nowCopy.adjustRelax ?? 'More relaxed'
  const labelEnergy = nowCopy.adjustEnergy ?? 'More lively'
  const labelTreat = nowCopy.adjustTreat ?? 'Something special'
  const base: AdjustmentConfig[] = [
    { label: labelRelax, value: 'relax' },
    { label: labelEnergy, value: 'energy' },
    { label: labelTreat, value: 'treat' },
  ]

  if (!emotion) return base
  if (emotion === 'relax') return [base[1], base[2]]
  if (emotion === 'energy') return [base[0], base[2]]
  if (emotion === 'treat') return [base[0], base[1]]
  if (emotion === 'social') return [base[0], base[2]]
  if (emotion === 'romantic') return [base[1], base[0]]
  if (emotion === 'explore') return [base[2], base[0]]
  return base
}

function getTimeZoneForCity(city?: string): string {
  const normalizedCity = city?.trim().toLowerCase()

  switch (normalizedCity) {
    case 'lisbon':
    case 'lisboa':
    case 'porto':
    case 'algarve':
    case 'madeira':
      return 'Europe/Lisbon'
    case 'barcelona':
    case 'madrid':
      return 'Europe/Madrid'
    case 'paris':
      return 'Europe/Paris'
    case 'london':
      return 'Europe/London'
    case 'rome':
    case 'milan':
      return 'Europe/Rome'
    case 'amsterdam':
      return 'Europe/Amsterdam'
    case 'berlin':
      return 'Europe/Berlin'
    default:
      return 'Europe/Lisbon'
  }
}

function getClientTimeSegment(): 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 10) return 'morning'
  if (hour >= 11 && hour <= 14) return 'midday'
  if (hour >= 15 && hour <= 18) return 'afternoon'
  if (hour >= 19 && hour <= 21) return 'evening'
  return 'night'
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
