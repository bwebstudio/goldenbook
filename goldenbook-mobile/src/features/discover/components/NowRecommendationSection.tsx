import { useState, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { getStorageUrl } from '@/utils/storage'
import { ProgressiveImage } from '@/components/ui/ProgressiveImage'
import { useTranslation } from '@/i18n'
import { useNowRecommendation, type NowEmotion } from '../hooks/useNowRecommendation'
import { useNowContextStore, type NowAdjustment } from '@/store/nowContextStore'
import { useSettingsStore } from '@/store/settingsStore'

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_HEIGHT = SCREEN_HEIGHT * 0.48

// ─── Weather → Ionicons vector icon ─────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

const WEATHER_ICON_MAP: Record<string, { name: IoniconsName; color: string }> = {
  sun:   { name: 'sunny-outline',  color: '#F5C542' },
  cloud: { name: 'cloudy-outline', color: '#CFD8DC' },
  rain:  { name: 'rainy-outline',  color: '#90CAF9' },
}

const WEATHER_CONDITION_TO_KEY: Record<string, string> = {
  sunny: 'sun', cloudy: 'cloud', rainy: 'rain', hot: 'sun', cold: 'cloud',
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
      city: data.place.city,
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
  const weatherIcon = weatherKey ? WEATHER_ICON_MAP[weatherKey] : null

  const eyebrow = context.moment_label
    ? `${context.moment_label.toUpperCase()} \u00B7 ${cityName.toUpperCase()}`
    : `${(t.now as any)[`eyebrow${capitalize(context.time_of_day)}`] ?? 'NOW'} ${cityName.toUpperCase()}`
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
        <ProgressiveImage
          uri={imageUrl}
          height={CARD_HEIGHT}
          resizeMode="cover"
          borderRadius={16}
          placeholderColor="#222D52"
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />

        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)',
          }}
          pointerEvents="none"
        />

        <LinearGradient
          colors={['transparent', 'transparent', 'rgba(17,35,67,0.55)', 'rgba(17,35,67,0.88)']}
          locations={[0, 0.28, 0.62, 1]}
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
            backgroundColor: 'rgba(0,0,0,0.45)',
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
          <View style={{ position: 'absolute', top: 16, left: 16 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, letterSpacing: 0.3 }}>
              Sponsored · Goldenbook
            </Text>
          </View>
        )}

        {/* Content overlay */}
        <View className="absolute bottom-0 left-0 right-0 p-7">
          <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
            <View style={{ width: 20, height: 1, backgroundColor: '#D2B68A', marginRight: 4 }} />
            <Text className="text-primary text-[9px] uppercase tracking-widest font-bold">
              {eyebrow}
            </Text>
          </View>

          <Text
            className="text-white text-2xl leading-snug mb-2"
            style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic', maxWidth: SCREEN_WIDTH * 0.72 }}
            numberOfLines={1}
          >
            {title}
          </Text>

          {subtitle ? (
            <Text className="text-white/60 text-[12px] tracking-wide mb-4 leading-relaxed" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            <View className="mb-4" />
          )}

          <Text
            className="text-white text-base font-bold tracking-wide mb-5"
            numberOfLines={1}
            style={{ maxWidth: SCREEN_WIDTH * 0.65 }}
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
      <View className="mx-6 mt-4 mb-1" style={{ gap: 10 }}>

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

        {/* ── Adjustment buttons ─────────────────────────────────────────── */}
        <View
          className="flex-row items-center justify-center"
          style={{ gap: 8, marginTop: 18, marginBottom: 4, flexWrap: 'wrap' }}
        >
          {adjustmentButtons.map((button) => (
            <AdjustmentPill
              key={`${button.label}-${button.value}`}
              label={button.label}
              onPress={() => navigateToConcierge(button.value)}
            />
          ))}
        </View>
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
  onRetry: () => void
  onConcierge: () => void
}

function NowEditorialFallback({ cityName, liveTime, t, onRetry, onConcierge }: NowEditorialFallbackProps) {
  const timeSegment = getClientTimeSegment()
  const headlineKey = `headline${capitalize(timeSegment)}`
  const headline: string = (t.now as any)[headlineKey] ?? t.now.headlineMorning

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
            style={{ fontFamily: 'PlayfairDisplay_400Regular_Italic', maxWidth: SCREEN_WIDTH * 0.72 }}
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
