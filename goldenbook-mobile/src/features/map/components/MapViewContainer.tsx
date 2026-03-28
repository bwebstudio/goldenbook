import { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useAppStore } from '@/store/appStore';
import { useMapPlaces } from '../hooks/useMapPlaces';
import { MapPin } from './MapPin';
import { PlacePreviewCard } from './PlacePreviewCard';
import { CITY_COORDS, DEFAULT_DELTA } from '../types/map.types';
import { colors, spacing, radius, elevation } from '@/design/tokens';
import type { MapPlace } from '@/types/api';

interface MapViewContainerProps {
  focusCoords?: { latitude: number; longitude: number };
}

const MIN_DELTA = 0.002;
const MAX_DELTA = 0.3;

export function MapViewContainer({ focusCoords }: MapViewContainerProps) {
  const city = useAppStore((s) => s.selectedCity);
  const { data: places, isLoading } = useMapPlaces();
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const mapRef = useRef<MapView>(null);
  const currentRegion = useRef<Region | null>(null);
  // Prevents the MapView onPress from firing a deselect right after a Marker onPress.
  // On Android, Marker touches can bubble up to the MapView in the same event cycle.
  const markerJustPressed = useRef(false);

  const cityCoords = CITY_COORDS[city] ?? CITY_COORDS['lisboa'];
  const initialRegion = focusCoords
    ? {
        ...focusCoords,
        latitudeDelta: DEFAULT_DELTA.latitudeDelta / 2,
        longitudeDelta: DEFAULT_DELTA.longitudeDelta / 2,
      }
    : { ...cityCoords, ...DEFAULT_DELTA };

  // When coming from Place Detail, auto-select the focused pin once places load
  useEffect(() => {
    if (!focusCoords || isLoading || !places?.length) return;
    const match = places.find(
      (p) => p.latitude === focusCoords.latitude && p.longitude === focusCoords.longitude
    );
    if (match) setSelectedPlace(match);
  }, [focusCoords, isLoading, places]);

  const handlePinPress = (place: MapPlace) => {
    markerJustPressed.current = true;
    // Replace any previously selected place — only one card at a time
    setSelectedPlace(place);
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: DEFAULT_DELTA.latitudeDelta / 2,
        longitudeDelta: DEFAULT_DELTA.longitudeDelta / 2,
      },
      350
    );
  };

  const handleMapPress = () => {
    if (markerJustPressed.current) {
      markerJustPressed.current = false;
      return;
    }
    setSelectedPlace(null);
  };

  const handleZoom = (direction: 'in' | 'out') => {
    const base = currentRegion.current ?? initialRegion;
    const factor = direction === 'in' ? 0.4 : 2.5;
    const newDelta = Math.min(
      MAX_DELTA,
      Math.max(MIN_DELTA, base.latitudeDelta * factor)
    );
    mapRef.current?.animateToRegion(
      { ...base, latitudeDelta: newDelta, longitudeDelta: newDelta },
      250
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onRegionChangeComplete={(region) => { currentRegion.current = region; }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        zoomEnabled
        scrollEnabled
      >
        {places?.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            onPress={() => handlePinPress(place)}
            tracksViewChanges={false}
          >
            <MapPin selected={selectedPlace?.id === place.id} />
          </Marker>
        ))}
      </MapView>

      {/* Zoom controls */}
      <View style={styles.zoomControls} pointerEvents="box-none">
        <TouchableOpacity
          onPress={() => handleZoom('in')}
          activeOpacity={0.8}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomIcon}>+</Text>
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity
          onPress={() => handleZoom('out')}
          activeOpacity={0.8}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomIcon}>−</Text>
        </TouchableOpacity>
      </View>

      {/* Loading overlay — sits above the map while pins load */}
      {isLoading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {selectedPlace && (
        <PlacePreviewCard
          key={selectedPlace.id}
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.base,
    bottom: 140,
    backgroundColor: colors.ivory.DEFAULT,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation.card,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomIcon: {
    fontSize: 22,
    color: colors.navy.DEFAULT,
    lineHeight: 26,
  },
  zoomDivider: {
    height: 1,
    backgroundColor: `${colors.navy.DEFAULT}10`,
    marginHorizontal: spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.ivory.DEFAULT}70`,
  },
});
