import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    HedvigLettersSerif_400Regular:
      "https://fonts.gstatic.com/s/hedviglettersserif/v4/OD5puN2I2mekHmyoU1Kj2AXOd5_7v7gIDlX8quj7viQ_N1HixEAZfw.ttf",
    PublicSans_400Regular:
      "https://fonts.gstatic.com/s/publicsans/v21/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymuFpm5ww.ttf",
    PublicSans_500Medium:
      "https://fonts.gstatic.com/s/publicsans/v21/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymuJJm5ww.ttf",
    PublicSans_700Bold:
      "https://fonts.gstatic.com/s/publicsans/v21/ijwGs572Xtc6ZYQws9YVwllKVG8qX1oyOymu8Z65ww.ttf",
    DMSans_400Regular:
      "https://fonts.gstatic.com/s/dmsans/v17/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTg.ttf",
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Listen for auth state changes across the whole app.
    // Handles: token refresh, sign-out, deep-link OAuth callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (_event === "SIGNED_IN" && session) {
          // New user (metadata.name undefined) → name onboarding
          // Returning user (name set or skipped with '') → go straight to tabs
          const completedOnboarding = session.user.user_metadata?.name !== undefined;
          router.replace(completedOnboarding ? "/(tabs)" : "/(onboarding)/name");
        } else if (_event === "SIGNED_OUT") {
          router.replace("/(onboarding)/welcome");
        }
      }
    );

    // Handle incoming deep links (OAuth callback: whether://auth/callback?code=...)
    const handleDeepLink = async (url: string) => {
      if (url.includes("auth/callback")) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error) {
          const completedOnboarding = data.user?.user_metadata?.name !== undefined;
          router.replace(completedOnboarding ? "/(tabs)" : "/(onboarding)/name");
        }
      }
    };

    // App already open when deep link arrives
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));

    // App was opened via deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
