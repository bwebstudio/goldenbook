import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import { getStorageUrl } from '@/utils/storage';
import { useTranslation } from '@/i18n';
import type { MediaAsset } from '@/types/api';
import type { StepStatus } from '../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface JourneyCompletionViewProps {
  routeTitle: string;
  stepStatuses: StepStatus[];
  heroImage: MediaAsset;
  onExploreMore: () => void;
}

export function JourneyCompletionView({
  routeTitle,
  stepStatuses,
  heroImage,
  onExploreMore,
}: JourneyCompletionViewProps) {
  const t = useTranslation();
  const visited = stepStatuses.filter(s => s === 'completed' || s === 'arrived').length;
  const skipped = stepStatuses.filter(s => s === 'skipped').length;
  const total = stepStatuses.length;
  const imageUrl = getStorageUrl(heroImage.bucket, heroImage.path);

  return (
    <View style={{ flex: 1 }}>
      <ProgressiveImage
        uri={imageUrl}
        height={SCREEN_HEIGHT}
        placeholderColor="#222D52"
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={['rgba(34,45,82,0.65)', 'rgba(34,45,82,0.92)']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
      >
        {/* Gold ring */}
        <View style={styles.goldRing}>
          <Text style={{ fontSize: 28, color: '#D2B68A' }}>✦</Text>
        </View>

        <Text className="text-primary text-[10px] tracking-widest uppercase font-bold text-center mt-6 mb-2">
          {t.journey.routeCompleted}
        </Text>

        <Text
          className="text-white text-3xl font-bold text-center leading-tight"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {routeTitle}
        </Text>

        <Text className="text-white/60 text-sm text-center mt-3 leading-relaxed">
          {t.journey.completionMessage}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text className="text-primary text-2xl font-bold">{visited}</Text>
            <Text className="text-white/50 text-[10px] uppercase tracking-widest mt-1">{t.journey.visited}</Text>
          </View>

          {skipped > 0 && (
            <View style={styles.stat}>
              <Text className="text-white/50 text-2xl font-bold">{skipped}</Text>
              <Text className="text-white/50 text-[10px] uppercase tracking-widest mt-1">{t.journey.skipped}</Text>
            </View>
          )}

          <View style={styles.stat}>
            <Text className="text-white text-2xl font-bold">{total}</Text>
            <Text className="text-white/50 text-[10px] uppercase tracking-widest mt-1">{t.journey.total}</Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onExploreMore}>
          <Text className="text-navy text-xs tracking-widest uppercase font-bold">
            {t.journey.exploreMoreRoutes}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  goldRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: '#D2B68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 32,
    marginBottom: 40,
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  stat: {
    alignItems: 'center',
  },
  cta: {
    backgroundColor: '#D2B68A',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 14,
    alignItems: 'center',
  },
});
