export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  lisboa: { latitude: 38.7169, longitude: -9.1399 },
  porto: { latitude: 41.1579, longitude: -8.6291 },
  madrid: { latitude: 40.4168, longitude: -3.7038 },
  paris: { latitude: 48.8566, longitude: 2.3522 },
};

export const DEFAULT_DELTA = {
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};