import { useState, useRef } from 'react';
import {
  View,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  FlatList,
  TouchableOpacity,
  Text,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getStorageUrl } from '@/utils/storage';
import { useTranslation } from '@/i18n';
import type { PlaceDetailDTO } from '../types';

type GalleryItem = PlaceDetailDTO['gallery'][number];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const THUMB_WIDTH = SCREEN_WIDTH * 0.62;
const THUMB_HEIGHT = THUMB_WIDTH * 0.75; // 4:3 — more elegant than the old 0.7

interface GallerySectionProps {
  gallery: GalleryItem[];
}

export function GallerySection({ gallery }: GallerySectionProps) {
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  if (!gallery.length) return null;

  const sorted = [...gallery].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  const urls = sorted.map((item) => getStorageUrl(item.bucket, item.path));

  const openViewer = (index: number) => {
    setActiveIndex(index);
    setViewerVisible(true);
  };

  return (
    <View className="mt-8 mb-2">
      {/* Section label */}
      <Text className="text-[10px] font-bold text-primary uppercase tracking-widest px-8 mb-4">
        {t.place.gallery}
      </Text>

      {/* Horizontal scroll thumbnails */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 32, gap: 12 }}
      >
        {sorted.map((item, idx) => {
          const url = urls[idx];
          return (
            <TouchableOpacity
              key={`${item.bucket}/${item.path}/${idx}`}
              onPress={() => openViewer(idx)}
              activeOpacity={0.88}
            >
              <View
                style={{
                  width: THUMB_WIDTH,
                  height: THUMB_HEIGHT,
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#D9D4CB',
                  shadowColor: '#222D52',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 12,
                  elevation: 2,
                }}
              >
                {url ? (
                  <Image
                    source={{ uri: url }}
                    style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Fullscreen viewer */}
      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setViewerVisible(false)}
      >
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Counter */}
          <Text
            style={{
              position: 'absolute',
              top: insets.top + 18,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 2,
              zIndex: 10,
            }}
          >
            {activeIndex + 1} / {sorted.length}
          </Text>

          {/* Close button */}
          <TouchableOpacity
            onPress={() => setViewerVisible(false)}
            style={{
              position: 'absolute',
              top: insets.top + 10,
              right: 20,
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Swipeable images */}
          <FlatList
            ref={flatListRef}
            data={urls}
            keyExtractor={(_, i) => String(i)}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActiveIndex(idx);
            }}
            renderItem={({ item: url }) => (
              <View
                style={{
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {url ? (
                  <Image
                    source={{ uri: url }}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.82 }}
                    resizeMode="contain"
                  />
                ) : null}
              </View>
            )}
          />

          {/* Dot indicators */}
          {sorted.length > 1 && (
            <View
              style={{
                position: 'absolute',
                bottom: insets.bottom + 28,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {sorted.map((_, i) => (
                <View
                  key={i}
                  style={{
                    marginHorizontal: 3,
                    width: i === activeIndex ? 18 : 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      i === activeIndex ? '#D2B68A' : 'rgba(255,255,255,0.28)',
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}