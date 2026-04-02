import { Stack } from 'expo-router';

export default function RoutesLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}