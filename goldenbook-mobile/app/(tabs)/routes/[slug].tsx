// One implementation for every `/routes/[slug]` route. expo-router resolves
// this path to either the root route or the one inside (tabs) depending on
// where the navigation starts (inside the tabs shell or from a root-level
// screen / deep link), so both files must render the same screen. Before this
// only the (tabs) copy sent route_start.
export { default } from '@/features/routes/screens/RouteDetailScreen';
