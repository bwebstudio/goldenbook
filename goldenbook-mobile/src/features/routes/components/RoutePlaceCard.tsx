import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getStorageUrl } from '@/utils/storage';
import { ProgressiveImage } from '@/components/ui/ProgressiveImage';
import type { RoutePlaceDTO } from '../types';

const IMAGE_SIZE = 76;

interface RoutePlaceCardProps {
  place: RoutePlaceDTO;
  index: number;
  isLast: boolean;
}

export const RoutePlaceCard = React.memo(function RoutePlaceCard({ place, index, isLast }: RoutePlaceCardProps) {
  const router = useRouter();
  const imageUrl = getStorageUrl(place.heroImage.bucket, place.heroImage.path);
  // Prefer the place's localized short description; fall back to the
  // curator's editorial note when no description is available.
  const description = place.shortDescription || place.note;

  return (
    <View className="flex-row px-6">
      {/* Timeline column */}
      <View className="items-center mr-5" style={{ width: 32 }}>
        {/* Number bubble */}
        <View
          className="items-center justify-center rounded-full z-10"
          style={{
            width: 30,
            height: 30,
            backgroundColor: '#222D52',
          }}
        >
          <Text className="text-ivory text-xs font-bold">{index + 1}</Text>
        </View>
        {/* Vertical connector — gold line */}
        {!isLast && (
          <View
            className="flex-1 mt-1"
            style={{ width: 1, backgroundColor: 'rgba(210,182,138,0.4)', minHeight: 36 }}
          />
        )}
      </View>

      {/* Card */}
      <TouchableOpacity
        onPress={() => router.push(`/places/${place.slug}` as any)}
        activeOpacity={0.88}
        className="flex-1 mb-5"
      >
        <View
          className="rounded-2xl overflow-hidden flex-row bg-ivory"
          style={{
            shadowColor: '#222D52',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* Image */}
          <ProgressiveImage
            uri={imageUrl}
            height={IMAGE_SIZE}
            placeholderColor="#222D52"
            style={{ width: IMAGE_SIZE, flexShrink: 0 }}
          />

          {/* Info */}
          <View className="flex-1 px-4 py-3 justify-center gap-1">
            <View className="flex-row items-center justify-between">
              <Text
                className="flex-1 text-sm font-bold text-navy"
                style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
                numberOfLines={1}
              >
                {place.name}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#D2B68A" />
            </View>

            {description && (
              <Text className="text-xs text-navy/50 italic" numberOfLines={2}>
                {description}
              </Text>
            )}

            {place.stayMinutes && (
              <View className="flex-row items-center gap-1">
                <Ionicons name="time-outline" size={11} color="#D2B68A" />
                <Text className="text-xs text-primary font-medium">
                  {place.stayMinutes < 60
                    ? `${place.stayMinutes}min`
                    : `${Math.floor(place.stayMinutes / 60)}h${place.stayMinutes % 60 > 0 ? ` ${place.stayMinutes % 60}min` : ''}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});
