import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Platform, Text, StyleSheet } from 'react-native';
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

/**
 * Translated tab label — rendered via tabBarLabel instead of title.
 * This lets translations update without changing the Tabs.Screen `options`
 * object identity, which would cause Expo Router to reset tab navigation.
 */
function TabLabel({ translationKey, color }: { translationKey: keyof ReturnType<typeof useTranslation>['tabs']; color: string }) {
  const t = useTranslation();
  return <Text style={[labelStyle.text, { color }]}>{t.tabs[translationKey]}</Text>;
}

const labelStyle = StyleSheet.create({
  text: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});

// Stable option objects — created once, never re-created on locale change.
// Translation-dependent text is rendered via tabBarLabel components above.
const discoverOpts  = { tabBarLabel: ({ color }: any) => <TabLabel translationKey="discover" color={color} />,  tabBarIcon: tabIcon('compass-outline', 'compass') };
const conciergeOpts = { tabBarLabel: ({ color }: any) => <TabLabel translationKey="concierge" color={color} />, tabBarIcon: tabIcon('chatbubble-outline', 'chatbubble') };
const routesOpts    = { tabBarLabel: ({ color }: any) => <TabLabel translationKey="routes" color={color} />,    tabBarIcon: tabIcon('navigate-outline', 'navigate') };
const savedOpts     = { tabBarLabel: ({ color }: any) => <TabLabel translationKey="saved" color={color} />,     tabBarIcon: tabIcon('heart-outline', 'heart') };
const profileOpts   = { tabBarLabel: ({ color }: any) => <TabLabel translationKey="profile" color={color} />,   tabBarIcon: tabIcon('person-outline', 'person') };
const hiddenOpts    = { href: null as any };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

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
      }}
    >
      <Tabs.Screen name="index"       options={discoverOpts} />
      <Tabs.Screen name="concierge"   options={conciergeOpts} />
      <Tabs.Screen name="routes"      options={routesOpts} />
      <Tabs.Screen name="saved"       options={savedOpts} />
      <Tabs.Screen name="profile"     options={profileOpts} />
      {/* Detail screens — inside tabs shell so the tab bar stays visible, hidden from tab bar */}
      <Tabs.Screen name="places"       options={hiddenOpts} />
      <Tabs.Screen name="categories"   options={hiddenOpts} />
      <Tabs.Screen name="golden-picks" options={hiddenOpts} />
    </Tabs>
  );
}
