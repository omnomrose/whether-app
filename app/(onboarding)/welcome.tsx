/**
 * Screen 1 — Auth Landing  (Figma node 341:154 "onboard | user credentials")
 *
 * Layout (Figma 393×852 reference, all y values are absolute):
 *   y=125   "whether" logo
 *   y=153   cloud (absolute, via AuthBackground)
 *   y=426   tagline — "know whether you should wear something (or not)."
 *   y=607   SIGN UP pill   (w=231, py=12, radius=36, bg=surface-100)
 *   y=670   — OR — divider (w=354, lines + label, gap=7)
 *   y=704   "SIGN IN USING" caption
 *   y=738   quick-logins row: 3 × 52px glass circles, w=231, justify-between
 */

import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import AuthBackground from '@/components/AuthBackground';
import { GoogleIcon, AppleIcon, MailIcon } from '@/components/SocialIcons';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Figma design reference (px)
const D_W = 393;
const D_H = 852;

// Absolute y positions from Figma
const D_LOGO_Y      = 125;
const D_TAGLINE_Y   = 426;
const D_SIGNUP_Y    = 607;
const D_OR_Y        = 670;
const D_LABEL_Y     = 704;
const D_ICONS_Y     = 738;

export default function WelcomeScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sy = H / D_H;

  const [loading, setLoading] = useState(false);

  // Convert Figma absolute y → local y relative to safe-area top
  const toY = (figmaY: number) => figmaY * sy - insets.top;

  // ── Google OAuth ────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL from Supabase.');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const { error: se } = await supabase.auth.exchangeCodeForSession(result.url);
        if (se) throw se;
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Sign in failed', e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ── Apple Sign-In ───────────────────────────────────────────────────────
  function signInWithApple() {
    Alert.alert(
      'Apple Sign-In',
      Platform.OS !== 'ios'
        ? 'Apple Sign-In is only available on iOS.'
        : 'Apple Sign-In requires a development build.\nInstall expo-apple-authentication and run `expo run:ios`.',
    );
  }

  // All elements use absolute positioning driven by Figma y values scaled to device height
  const logoTop    = Math.max(8, toY(D_LOGO_Y));
  const taglineTop = Math.max(0, toY(D_TAGLINE_Y));
  const signUpTop  = Math.max(0, toY(D_SIGNUP_Y));
  const orTop      = Math.max(0, toY(D_OR_Y));
  const labelTop   = Math.max(0, toY(D_LABEL_Y));
  const iconsTop   = Math.max(0, toY(D_ICONS_Y));

  // Horizontal centre for 231px elements on this device
  const cx = W / 2 - 231 / 2;

  return (
    <AuthBackground>
      <View style={[styles.canvas, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* ── Logo — Figma y=125 ───────────────────────────────────────── */}
        <Text style={[styles.logo, { marginTop: logoTop }]}>
          whether
        </Text>

        {/* ── Tagline — Figma y=426, w=293 ────────────────────────────── */}
        <View style={{ height: taglineTop - logoTop - 28 }} />
        <Text style={styles.tagline}>
          know whether you should wear{'\n'}something (or not).
        </Text>

        {/* ── SIGN UP — Figma y=607, w=231, radius=36 ─────────────────── */}
        <View style={{ flex: 1 }} />
        <View style={[styles.actionsBlock, { paddingBottom: insets.bottom + 20 }]}>

          <Pressable
            style={({ pressed }) => [styles.signUpBtn, pressed && styles.dimmed]}
            onPress={() => router.push('/(onboarding)/auth-email?mode=signup')}
          >
            <Text style={styles.signUpLabel}>sign up</Text>
          </Pressable>

          {/* — OR — divider — Figma y=670, w=354, gap=7 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* "SIGN IN USING" — Figma y=704 */}
          <Text style={styles.signInUsing}>sign in using</Text>

          {/* Quick logins — Figma node 409:86, y=738, w=231, justify-between */}
          <View style={styles.socialRow}>

            {/* Google — 409:77 */}
            <Pressable
              onPress={signInWithGoogle}
              style={({ pressed }) => [pressed && styles.dimmed]}
              accessibilityLabel="Sign in with Google"
            >
              <GlassCircle>
                <GoogleIcon size={20} />
              </GlassCircle>
            </Pressable>

            {/* Apple — 409:78 */}
            <Pressable
              onPress={signInWithApple}
              style={({ pressed }) => [pressed && styles.dimmed]}
              accessibilityLabel="Sign in with Apple"
            >
              <GlassCircle>
                <AppleIcon />
              </GlassCircle>
            </Pressable>

            {/* Mail — 409:80 */}
            <Pressable
              onPress={() => router.push('/(onboarding)/auth-email?mode=signin')}
              style={({ pressed }) => [pressed && styles.dimmed]}
              accessibilityLabel="Sign in with email"
            >
              <GlassCircle>
                <MailIcon />
              </GlassCircle>
            </Pressable>

          </View>
        </View>
      </View>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.surface[100]} size="large" />
        </View>
      )}
    </AuthBackground>
  );
}

// ── GlassCircle ──────────────────────────────────────────────────────────────
// Figma annotation "use glass effect" on node 409:80 (applies to all 3 icons).
// Uses glass-linear token: top-heavy white gradient over the blue background.
// LinearGradient is consistent on both iOS and Android (BlurView tints vary).
function GlassCircle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.glassOuter}>
      <LinearGradient
        // glass-linear adapted for circles: opaque-ish white at top → translucent at bottom
        colors={['rgba(245,244,244,0.55)', 'rgba(245,244,244,0.22)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glassInner}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-screen canvas — children use margin-based absolute-style positioning
  canvas: {
    flex: 1,
    zIndex: 1,
  },

  // ── Typography ────────────────────────────────────────────────────────────

  // Figma: Hedvig Letters Serif 24px -1.2 #f5f4f4 centred
  logo: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -1.2,
    color: Colors.surface[100],
    textAlign: 'center',
  },

  // Figma: same as logo, w=293 centred, y=426
  tagline: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -1.2,
    color: Colors.surface[100],
    textAlign: 'center',
    width: 293,
    alignSelf: 'center',
  },

  // ── Bottom actions block ──────────────────────────────────────────────────
  actionsBlock: {
    alignItems: 'center',
    gap: 16,
  },

  // Figma: w=231, py=12, radius=36, bg=surface-100 (#f5f4f4), shadow-card
  signUpBtn: {
    backgroundColor: Colors.surface[100],
    borderRadius: 36,
    paddingVertical: 12,
    width: 231,
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 5,
  },
  signUpLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.28,
    color: Colors.surface[200],
    textTransform: 'uppercase',
  },

  // Figma: w=354, gap=7 between lines and "or" label
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 354,
    gap: 7,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface[100],
    opacity: 0.65,
  },
  dividerText: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.28,
    color: Colors.surface[100],
    textTransform: 'uppercase',
  },

  // Figma: body-sm uppercase surface-100, y=704
  signInUsing: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.28,
    color: Colors.surface[100],
    textTransform: 'uppercase',
  },

  // Figma 409:86: 231px container, 3 circles, justify-between
  socialRow: {
    flexDirection: 'row',
    width: 231,
    justifyContent: 'space-between',
  },

  // ── Glass circle — node 409:77/78/80 ─────────────────────────────────────
  // 52×52, radius=26, border rgba(f5f4f4, 0.45), overflow hidden clips gradient
  glassOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245,244,244,0.45)',
  },
  glassInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dimmed: { opacity: 0.7 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
});
