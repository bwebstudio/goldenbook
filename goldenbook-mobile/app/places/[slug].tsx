// One implementation for every `/places/[slug]` route. expo-router resolves
// this path to either the root route or the one inside (tabs) depending on
// where the navigation starts, so both files must render the same screen.
export { default } from '@/features/place-detail/screens/PlaceDetailScreen';
