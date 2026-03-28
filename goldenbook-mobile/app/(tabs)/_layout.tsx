import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/i18n';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Visual content area: top indicator line + icon + gap before label
// Label height is handled separately by tabBarLabelStyle
const CONTENT_HEIGHT = 54;

function tabIcon(outlined: IoniconsName, filled: IoniconsName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <View style={{ alignItems: 'center' }}>
      {/* Gold top-line indicator — appears/disappears without shifting layout */}
      <View
        style={{
          width: 20,
          height: 2,
          borderRadius: 1,
          backgroundColor: focused ? '#D2B68A' : 'transparent',
          marginBottom: 8,
        }}
      />
      <Ionicons name={focused ? filled : outlined} size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const t = useTranslation();

  // On iPhone with home indicator, insets.bottom ≈ 34.
  // We extend the bar behind it and push content up with paddingBottom.
  const bottomInset = insets.bottom;
  const tabBarHeight = CONTENT_HEIGHT + bottomInset;
  // Leave a small gap above the home indicator (4px feels natural)
  const paddingBottom = bottomInset > 0 ? bottomInset + 4 : Platform.OS === 'android' ? 6 : 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FDFDFB',
          borderTopWidth: 1,
          borderTopColor: 'rgba(34,45,82,0.07)',
          height: tabBarHeight,
          paddingTop: 0,
          paddingBottom,
        },
        tabBarActiveTintColor: '#222D52',
        tabBarInactiveTintColor: 'rgba(34,45,82,0.28)',
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t.tabs.discover, tabBarIcon: tabIcon('compass-outline', 'compass') }}
      />
      <Tabs.Screen
        name="concierge"
        options={{ title: t.tabs.concierge, tabBarIcon: tabIcon('chatbubble-outline', 'chatbubble') }}
      />
      <Tabs.Screen
        name="routes"
        options={{ title: t.tabs.routes, tabBarIcon: tabIcon('navigate-outline', 'navigate') }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: t.tabs.saved, tabBarIcon: tabIcon('heart-outline', 'heart') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t.tabs.profile, tabBarIcon: tabIcon('person-outline', 'person') }}
      />
      {/* Detail screens — inside tabs shell so the tab bar stays visible, hidden from tab bar */}
      <Tabs.Screen name="places" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="routes/[slug]" options={{ href: null }} />
      <Tabs.Screen name="golden-picks" options={{ href: null }} />
    </Tabs>
  );
}
