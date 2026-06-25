/**
 * Screen 2 — Email Auth  (Figma node 424:339 "onboard | email")
 *
 * Layout (Figma 393×852 reference, sign-up mode):
 *   y=125  "sign up to get started" title
 *   y=153  cloud (absolute, via AuthBackground)
 *   y=469  EMAIL label + input (h=43, radius=24, bg=#f5f4f4)
 *   y=558  PASSWORD label + input (h=43, with eye-off icon)
 *   y=632  password hint (italic 10px)
 *   y=733  CONTINUE TO VERIFICATION button (w=231, py=16, radius=24, bg=#2b1e1e)
 *
 * Dual mode via ?mode=signup (default) or ?mode=signin
 */

import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthBackground from '@/components/AuthBackground';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { supabase } from '@/lib/supabase';

// Design reference
const D_H = 852;

// All 4 requirements must pass (Figma node 424:339, annotation on 435:32)
function isValidPassword(pw: string) {
  return (
    pw.length >= 6 &&
    /[0-9]/.test(pw) &&
    /[a-z]/.test(pw) && /[A-Z]/.test(pw) &&
    /[^a-zA-Z0-9]/.test(pw)
  );
}

const PASSWORD_REQS = [
  { key: 'length',   label: 'min 6 characters long',              test: (p: string) => p.length >= 6 },
  { key: 'number',   label: 'contains numbers',                   test: (p: string) => /[0-9]/.test(p) },
  { key: 'mixCase',  label: 'contains 1+ lower case, capital letter', test: (p: string) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'special',  label: 'contains 1+ special characters',     test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
] as const;

export default function AuthEmailScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isSignUp = mode !== 'signin';

  const { height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const sy = H / D_H;

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [emailErr, setEmailErr]     = useState('');
  const [passErr, setPassErr]       = useState('');

  const passRef = useRef<TextInput>(null);

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    let ok = true;
    setEmailErr('');
    setPassErr('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailErr('Enter a valid email address.');
      ok = false;
    }
    if (!password) {
      setPassErr('Password is required.');
      ok = false;
    } else if (isSignUp && !isValidPassword(password)) {
      setPassErr('Please meet all password requirements.');
      ok = false;
    }
    return ok;
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (data.session) {
          // Confirmation disabled — session established.
          // onAuthStateChange in _layout.tsx fires SIGNED_IN and routes to
          // /(onboarding)/location (new user) or /(tabs) (returning user).
        } else {
          // Confirmation required — go to OTP verify screen.
          router.push(`/(onboarding)/verify-email?email=${encodeURIComponent(email.trim())}`);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw new Error('Invalid email or password. Please try again.');
        // onAuthStateChange handles routing.
      }
    } catch (e: any) {
      Alert.alert(isSignUp ? 'Sign up failed' : 'Sign in failed', e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // Vertical spacing proportional to Figma
  const titleTop   = Math.max(8, 125 * sy - insets.top);
  const formOffset = (469 - 125) * sy; // distance from title area to form

  return (
    <AuthBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back arrow */}
          <Pressable style={[styles.backBtn, { marginTop: 12 }]} onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color={Colors.surface[100]} />
          </Pressable>

          {/* Title */}
          <Text style={[styles.title, { marginTop: titleTop - 12 }]}>
            {isSignUp ? 'sign up to get started' : 'sign in to whether'}
          </Text>

          {/* Spacer — pushes form down to ~y=469 proportionally */}
          <View style={{ height: Math.max(16, formOffset * 0.55) }} />

          {/* ── EMAIL ─────────────────────────────────────────────────── */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>email</Text>
            <TextInput
              style={[styles.input, !!emailErr && styles.inputError]}
              placeholder="example@gmail.com"
              placeholderTextColor={Colors.surface[150]}
              value={email}
              onChangeText={t => { setEmail(t); emailErr && setEmailErr(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />
            {!!emailErr && <Text style={styles.errText}>{emailErr}</Text>}
          </View>

          {/* ── PASSWORD ──────────────────────────────────────────────── */}
          <View style={[styles.fieldWrap, { marginTop: 24 }]}>
            <Text style={styles.fieldLabel}>password</Text>
            <View style={[styles.input, styles.inputRow, !!passErr && styles.inputError]}>
              <TextInput
                ref={passRef}
                style={styles.passwordInputInner}
                placeholder={isSignUp ? 'Strong Password' : '••••••••'}
                placeholderTextColor={Colors.surface[150]}
                value={password}
                onChangeText={t => { setPassword(t); passErr && setPassErr(''); }}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              {/* eye-off icon — Figma node 424:444 */}
              <Pressable onPress={() => setShowPass(v => !v)} hitSlop={10}>
                <Ionicons
                  name={showPass ? 'eye-outline' : 'eye-off-outline'}
                  size={16}
                  color={Colors.surface[150]}
                />
              </Pressable>
            </View>
            {!!passErr && <Text style={styles.errText}>{passErr}</Text>}
          </View>

          {/* ── Password requirements — Figma node 435:45, annotation 435:32 ── */}
          {/* Visible only on sign-up; circle → filled checkmark when req met   */}
          {isSignUp && (
            <View style={styles.reqs}>
              {PASSWORD_REQS.map(({ key, label, test }) => {
                const met = test(password);
                return (
                  <View key={key} style={styles.reqRow}>
                    {met ? (
                      <Ionicons name="checkmark-circle" size={11} color={Colors.surface[100]} />
                    ) : (
                      <View style={styles.reqCircle} />
                    )}
                    <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Flex gap before button */}
          <View style={styles.buttonSpacer} />

          {/* ── CONTINUE / SIGN IN button ─────────────────────────────── */}
          {/* Figma: w=231, py=16, radius=24, bg=#2b1e1e, shadow-card, centered */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.dimmed, loading && styles.submitLoading]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.surface[100]} size="small" />
            ) : (
              <Text style={styles.submitLabel}>
                {isSignUp ? 'continue to verification' : 'sign in'}
              </Text>
            )}
          </Pressable>

          {/* Toggle sign-up ↔ sign-in */}
          <Pressable
            style={styles.toggleBtn}
            onPress={() =>
              router.replace(
                isSignUp
                  ? '/(onboarding)/auth-email?mode=signin'
                  : '/(onboarding)/auth-email?mode=signup',
              )
            }
          >
            <Text style={styles.toggleText}>
              {isSignUp
                ? 'already have an account? sign in'
                : "don't have an account? sign up"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },

  backBtn: {
    alignSelf: 'flex-start',
  },

  // Figma: Hedvig Letters Serif 24px -1.2 #f5f4f4 centered
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -1.2,
    color: Colors.surface[100],
    textAlign: 'center',
  },

  // ── Form fields ─────────────────────────────────────────────────────────
  fieldWrap: { gap: 8 },

  // Figma: Public Sans 12px -0.18 UPPERCASE #f5f4f4
  fieldLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color: Colors.surface[100],
  },

  // Figma: h=43, radius=24, bg=#f5f4f4, px=16
  input: {
    backgroundColor: Colors.surface[100],
    borderRadius: 24,
    height: 43,
    paddingHorizontal: 16,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color: Colors.surface[200],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputInner: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color: Colors.surface[200],
    height: '100%',
  },
  // Password input: no textTransform so placeholder shows as "Strong Password" (Figma spec)
  passwordInputInner: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    color: Colors.surface[200],
    height: '100%',
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: Colors.danger[100],
  },

  errText: {
    fontFamily: FontFamily.sans,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.danger[30],
    textTransform: 'lowercase',
  },

  // ── Password requirements — Figma node 435:45 ───────────────────────────
  reqs: {
    marginTop: 12,
    gap: 6,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  // Unfilled circle (unmet requirement)
  reqCircle: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,244,244,0.55)',
  },
  // Requirement label text
  reqText: {
    fontFamily: FontFamily.sans,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color: Colors.surface[100],
    opacity: 0.65,
  },
  // Met requirement — full opacity
  reqTextMet: {
    opacity: 1,
  },

  buttonSpacer: { flex: 1, minHeight: 32 },

  // Figma: w=231, py=16, radius=24, bg=#2b1e1e, shadow-card, centered
  submitBtn: {
    backgroundColor: Colors.surface[200],
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 10,
    width: 231,
    alignSelf: 'center',
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 5,
  },
  submitLoading: { opacity: 0.75 },
  // Figma: Public Sans 12px uppercase #f5f4f4
  submitLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color: Colors.surface[100],
  },

  toggleBtn: {
    alignSelf: 'center',
    paddingVertical: 16,
  },
  toggleText: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: -0.18,
    textTransform: 'lowercase',
    color: Colors.surface[100],
    opacity: 0.75,
  },

  dimmed: { opacity: 0.8 },
});
