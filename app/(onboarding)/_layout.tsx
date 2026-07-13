import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:       false,
        animation:         'fade',
        animationDuration: 380,
        gestureEnabled:    false,
      }}
    >
      {/* photo-confirm slides up from the bottom (ease-in/out) and drops back down on dismiss */}
      <Stack.Screen
        name="photo-confirm"
        options={{
          animation:         'slide_from_bottom',
          animationDuration: 320,
          gestureEnabled:    false,
        }}
      />
    </Stack>
  );
}


