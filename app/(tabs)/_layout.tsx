import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="closet" options={{ title: "Closet" }} />
      <Tabs.Screen name="outfit" options={{ title: "Outfit" }} />
    </Tabs>
  );
}
