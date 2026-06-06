import { View, StyleSheet } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import GlassNavBar from '@/components/GlassNavBar';

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
      {/* Default tab bar hidden — GlassNavBar provides navigation instead */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        {/* Order matches GlassNavBar left→right: closet, outfit, index (home) */}
        <Tabs.Screen name="closet" />
        <Tabs.Screen name="outfit" />
        <Tabs.Screen name="index"  />
      </Tabs>

      {/* Floating glass nav bar — absolute, zIndex 55, above all screen content */}
      <GlassNavBar activeTab={activeTab} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
