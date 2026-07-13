import { View, StyleSheet } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import NavBar from '@/components/NavBar';

export default function TabsLayout() {
  // Determine active tab index from path segments.
  // useSegments() returns e.g. ['(tabs)', 'closet'] for /closet.
  const segments = useSegments();
  const lastSeg  = segments[segments.length - 1];
  const activeTab: 0 | 1 | 2 =
    lastSeg === 'closet' ? 0 :
    lastSeg === 'outfit' ? 1 : 2;

  return (
    <View style={s.root}>
      {/* Default tab bar hidden — NavBar provides navigation instead */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        {/* Order matches NavBar left→right: closet, outfit, index (home) */}
        <Tabs.Screen name="closet" />
        <Tabs.Screen name="outfit" />
        <Tabs.Screen name="index"  />
      </Tabs>

      {/* Floating nav bar — absolute, zIndex 55, above all screen content */}
      <NavBar activeTab={activeTab} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
