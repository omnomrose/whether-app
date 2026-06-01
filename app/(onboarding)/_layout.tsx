import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right', // enables iOS swipe-back gesture
        gestureEnabled: true,
      }}
    />
  );
}


