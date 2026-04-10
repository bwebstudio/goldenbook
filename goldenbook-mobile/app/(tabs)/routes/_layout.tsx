import { Stack, useNavigation, useRouter } from 'expo-router';
import { StackActions } from '@react-navigation/native';
import { useEffect } from 'react';

export default function RoutesLayout() {
  const navigation = useNavigation();
  const router = useRouter();

  // When the Routes tab is tapped while already focused, pop back to index
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      if (navigation.canGoBack()) {
        try {
          navigation.dispatch(StackActions.popToTop());
        } catch {
          // Fallback: navigate directly to routes index
          router.navigate('/(tabs)/routes');
        }
      }
    });
    return unsubscribe;
  }, [navigation, router]);

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
