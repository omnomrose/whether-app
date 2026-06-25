/**
 * Entry point — checks Supabase session on mount.
 * Redirects to /(tabs) if authenticated, /(onboarding)/welcome if not.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Check for an existing persisted session (e.g. returning user)
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  // Still checking — render nothing (splash screen stays visible)
  if (session === undefined) return <View />;

  if (session) {
    const completedOnboarding = session.user.user_metadata?.whether_onboarded === true;
    return <Redirect href={completedOnboarding ? "/(tabs)" : "/(onboarding)/location"} />;
  }
  return <Redirect href="/(onboarding)/welcome" />;
}
