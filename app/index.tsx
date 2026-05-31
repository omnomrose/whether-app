import { Redirect } from "expo-router";

// Entry point — redirect to onboarding or tabs based on auth state
// TODO: check Supabase session and redirect accordingly
export default function Index() {
  return <Redirect href="/(onboarding)/welcome" />;
}
