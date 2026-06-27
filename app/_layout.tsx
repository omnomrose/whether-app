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
    HedvigLettersSerif_400Regular: require("@expo-google-fonts/hedvig-letters-serif/400Regular/HedvigLettersSerif_400Regular.ttf"),
    DMMono_400Regular: require("@expo-google-fonts/dm-mono/400Regular/DMMono_400Regular.ttf"),
    DMMono_500Medium: require("@expo-google-fonts/dm-mono/500Medium/DMMono_500Medium.ttf"),
    DMSans_400Regular: require("@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf"),
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
          // whether_onboarded:true = user has set their location at least once
          // Google users have `name` from OAuth so we can't use that as the flag
          const completedOnboarding = session.user.user_metadata?.whether_onboarded === true;
          router.replace(completedOnboarding ? "/(tabs)" : "/(onboarding)/name");
        } else if (_event === "SIGNED_OUT") {
          router.replace("/(onboarding)/welcome");
        }
      }
    );

    // Handle incoming deep links (OAuth callback: whether://auth/callback?code=...)
    // Only needed for cold-start / Android deep links — foreground OAuth is
    // handled by openAuthSessionAsync in welcome.tsx.
    const handleDeepLink = async (url: string) => {
      if (!url.includes("auth/callback")) return;
      // Skip if a session was already established by the foreground OAuth handler
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;
      const { data, error } = await supabase.auth.exchangeCodeForSession(url);
      if (!error) {
        const completedOnboarding = data.user?.user_metadata?.whether_onboarded === true;
        router.replace(completedOnboarding ? "/(tabs)" : "/(onboarding)/name");
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
