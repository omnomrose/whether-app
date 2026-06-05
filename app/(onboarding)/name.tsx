// Onboarding screen 2 — name entry
// Same sky-gradient + parallax-cloud background as welcome.tsx via SkyBackground.
// When the user confirms their name the UI fades to transparent over 420 ms,
// then the router navigates to the location screen.

import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import SkyBackground from '@/components/SkyBackground';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

const NAMETAG_IMAGE = require('@/assets/images/nametag.png');

// ─── Figma spec (frame: 393 × 844) ──────────────────────────────────────────
const NAMETAG_W = 334;
const NAMETAG_H = 223;
const NAMETAG_LEFT = 29;
const NAMETAG_TOP = 295;
const FRAME_H = 844;
const NAME_TOP = 406 - NAMETAG_TOP; // 111 — sits in the white area of the sticker
// ─────────────────────────────────────────────────────────────────────────────

export default function NameScreen() {
  const [name, setName] = useState('');
  const inputRef = useRef<TextInput>(null);
  const { height } = useWindowDimensions();

  // Scale the nametag position to the actual device height
  const nametagTop = NAMETAG_TOP * (height / FRAME_H);

  // ── Fade-out ────────────────────────────────────────────────────────────────
  // Wraps all UI elements (not the sky — that stays until the screen fully
  // transitions away, making the cloud feel like part of the world).
  const uiOpacity = useSharedValue(1);
  const uiStyle = useAnimatedStyle(() => ({ opacity: uiOpacity.value }));

  const goToLocation = () => router.push('/(onboarding)/location');
  const goToTabs = () => router.replace('/(tabs)');

  /** Dismiss keyboard → fade UI to 0 → navigate */
  const fadeAndGo = (onDone: () => void) => {
    Keyboard.dismiss();
    uiOpacity.value = withTiming(0, { duration: 420 }, (finished) => {
      'worklet';
      if (finished) runOnJS(onDone)();
    });
  };
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <SkyBackground>
          {/* All tappable UI lives inside this animated wrapper so the sky */}
          {/* persists while the name prompt dissolves on continue.         */}
          <Animated.View style={[styles.ui, uiStyle]} pointerEvents="box-none">
            {/* Skip */}
            <Pressable
              style={styles.skip}
              onPress={() => fadeAndGo(goToTabs)}
              hitSlop={12}
            >
              <Text style={styles.skipText}>skip</Text>
            </Pressable>

            {/* Nametag — fixed 334 × 223, editable name overlay */}
            <Pressable
              style={[styles.nametag, { left: NAMETAG_LEFT, top: nametagTop }]}
              onPress={() => inputRef.current?.focus()}
            >
              <Image
                source={NAMETAG_IMAGE}
                style={{ width: NAMETAG_W, height: NAMETAG_H }}
                resizeMode="contain"
              />

              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="your name"
                placeholderTextColor="rgba(29,29,29,0.35)"
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (name.trim()) fadeAndGo(goToLocation);
                }}
                autoCorrect={false}
                autoCapitalize="characters"
                style={styles.nameInput}
              />
            </Pressable>

            {/* Continue — appears once a name is typed */}
            {name.trim().length > 0 && (
              <Pressable
                style={styles.continueBtn}
                onPress={() => fadeAndGo(goToLocation)}
              >
                <Text style={styles.continueText}>continue</Text>
              </Pressable>
            )}
          </Animated.View>
        </SkyBackground>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.gradient.clearSky.colors[0],
  },
  // Fills SkyBackground, passes touches through to children
  ui: {
    flex: 1,
  },
  skip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 1,
  },
  skipText: {
    ...Typography.caption,
    color: Colors.text.muted,
  },
  nametag: {
    position: 'absolute',
    width: NAMETAG_W,
    height: NAMETAG_H,
  },
  continueBtn: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: Colors.surface[200],
    borderRadius: 200,
  },
  continueText: {
    ...Typography.caption,
    color: Colors.surface[100],
  },
  nameInput: {
    position: 'absolute',
    top: NAME_TOP,
    left: 0,
    right: 0,
    textAlign: 'center',
    ...Typography.bodyXl,
    textTransform: 'uppercase',
    color: Colors.text.primary,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
});
