/**
 * Screen 3 — OTP Verification  (Figma node 424:312 "onboard | email")
 *
 * Layout (Figma 393×852 reference):
 *   y=125  "verify your email" title
 *   y=153  cloud (absolute, via AuthBackground)
 *   y=473  6 OTP digit boxes (w≈47, h=70, gap=14, radius=8)
 *            Each box: glass gradient — #f5f4f4 at top → rgba(f5f4f4,0.44) at 24.5% → transparent at bottom
 *   y=571  "RESEND CODE" label
 *
 * Auto-advances focus on digit entry. Auto-verifies when all 6 are filled.
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AuthBackground from '@/components/AuthBackground';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

// Design reference
const D_W = 393;
const D_H = 852;

// OTP box measurements from Figma (in design px)
// 6 boxes, each 47px wide, gap 14px, total span = 6*47 + 5*14 = 282+70 = 352 ≈ 353px (left=20, right=373)
const D_OTP_TOP    = 473;
const D_OTP_HEIGHT =  70;
const D_OTP_WIDTH  =  47; // last box is 48 but we use 47 uniformly
const D_OTP_GAP    =  14;
const D_RESEND_TOP = 571;

export default function VerifyEmailScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sx = W / D_W;
  const sy = H / D_H;

  // Email forwarded from auth-email.tsx via route param (session not yet active pre-verification)
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const refs = useRef<Array<TextInput | null>>([null, null, null, null, null, null]);

  // Proportional sizes
  const otpBoxH   = Math.round(D_OTP_HEIGHT * sy);
  const otpBoxW   = Math.round(D_OTP_WIDTH  * sx);
  const otpGap    = Math.round(D_OTP_GAP    * sx);
  const otpTop    = Math.round(D_OTP_TOP    * sy) - insets.top;
  const resendTop = Math.round(D_RESEND_TOP * sy) - insets.top;

  // ── Digit input handlers ────────────────────────────────────────────────
  function handleChange(text: string, i: number) {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
    if (next.every(d => d !== '')) verify(next.join(''));
  }

  function handleKeyPress(key: string, i: number) {
    if (key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        setDigits(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        const next = [...digits];
        next[i - 1] = '';
        setDigits(next);
      }
    }
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────
  async function verify(code: string) {
    if (!emailParam) {
      Alert.alert('Error', 'Email not found. Please sign up again.');
      router.replace('/(onboarding)/welcome');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailParam,
        token: code,
        type: 'signup',
      });
      if (error) throw error;
      // onAuthStateChange fires SIGNED_IN → routes to /(onboarding)/location or /(tabs)
    } catch (e: any) {
      Alert.alert('Verification failed', e.message ?? 'Invalid code. Try again.');
      setDigits(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────
  async function resend() {
    if (!emailParam) { router.replace('/(onboarding)/welcome'); return; }
    const { error } = await supabase.auth.resend({ type: 'signup', email: emailParam });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Sent', 'New code sent — check your inbox.');
  }

  const titleTop = Math.max(8, 125 * sy - insets.top);

  return (
    <AuthBackground>
      <View style={[styles.wrap, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>

        {/* Title — "verify your email", Hedvig Serif 24px */}
        <Text style={[styles.title, { marginTop: titleTop }]}>
          verify your email
        </Text>

        {/* ── OTP boxes — positioned proportionally from Figma y=473 ─── */}
        <View style={[styles.otpRow, { marginTop: otpTop - titleTop - 28, gap: otpGap }]}>
          {digits.map((digit, i) => (
            <GlassBox
              key={i}
              width={otpBoxW}
              height={otpBoxH}
              value={digit}
              focused={false}
              onRef={el => { refs.current[i] = el; }}
              onChange={t => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              onFocus={() => {}}
              loading={loading}
            />
          ))}
        </View>

        {/* RESEND CODE — Figma y=729, dark pill w=231, radius=20, bg=#2b1e1e */}
        <View style={styles.resendWrap}>
          <Pressable
            style={({ pressed }) => [styles.resendBtn, pressed && { opacity: 0.8 }]}
            onPress={resend}
          >
            <Text style={styles.resendText}>resend code</Text>
          </Pressable>
        </View>

      </View>
    </AuthBackground>
  );
}

// ── GlassBox ─────────────────────────────────────────────────────────────────
// Individual OTP digit cell.
// Figma: gradient bg (#f5f4f4 top → rgba(f5f4f4,0.44) at 24.5% → transparent bottom)
//        radius=8, w≈47, h=70

interface GlassBoxProps {
  width: number;
  height: number;
  value: string;
  focused: boolean;
  loading: boolean;
  onRef: (el: TextInput | null) => void;
  onChange: (t: string) => void;
  onKeyPress: (e: any) => void;
  onFocus: () => void;
}

function GlassBox({ width, height, value, loading, onRef, onChange, onKeyPress, onFocus }: GlassBoxProps) {
  return (
    // Figma gradient: gradient-to-t (bottom→top) transparent → 0.44 white → opaque white
    <LinearGradient
      colors={['rgba(245,244,244,0)', 'rgba(245,244,244,0.44)', '#f5f4f4']}
      locations={[0, 0.24519, 1]}
      start={{ x: 0, y: 1 }}   // start at bottom
      end={{ x: 0, y: 0 }}     // end at top
      style={[styles.glassBox, { width, height, borderRadius: 8 }]}
    >
      <TextInput
        ref={onRef}
        style={[
          styles.digitInput,
          { fontSize: Math.round(height * 0.36) }, // scale font with box
        ]}
        value={value}
        onChangeText={onChange}
        onKeyPress={onKeyPress}
        onFocus={onFocus}
        keyboardType="number-pad"
        maxLength={1}
        editable={!loading}
        textAlign="center"
        caretHidden
        selectTextOnFocus
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    zIndex: 1,
  },

  // "verify your email" — Hedvig Serif 24px -1.2 #f5f4f4 centered
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -1.2,
    color: Colors.surface[100],
    textAlign: 'center',
  },

  // 6 boxes in a row
  otpRow: {
    flexDirection: 'row',
    alignSelf: 'stretch', // fills paddingHorizontal=20 area → 353px on 393 screen
    justifyContent: 'space-between',
  },

  // Glass box container (LinearGradient fills this)
  glassBox: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Digit text input — transparent bg (gradient shows through)
  digitInput: {
    backgroundColor: 'transparent',
    color: Colors.surface[200],
    fontFamily: FontFamily.sans,
    fontWeight: '500',
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
  },

  // Figma: absolute bottom area, centred
  resendWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },

  // Figma node 472:35 — bg=#2b1e1e, px=8, py=12, radius=20, w=231
  resendBtn: {
    backgroundColor: Colors.surface[200],
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: 231,
    alignItems: 'center',
  },
  resendText: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color: Colors.surface[100],
  },
});
