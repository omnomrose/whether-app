// Figma node 144:68 — "onboard | scan clothes"
// Standalone tutorial screen reached by tapping the closet (shirt) button.
// The ClosetTutorialCard springs in from scale 0 on mount — matches the
// "morph from button" feel while keeping this a clean, isolated screen.
//
// Annotation: "ask if it's ok to use camera" — handled in onConfirm.

import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import ClosetTutorialCard from '@/components/ClosetTutorialCard';
import { Colors } from '@/constants/Colors';
import { Typography, FontFamily } from '@/constants/Typography';

// ─── Constants ────────────────────────────────────────────────────────────────
const FIGMA_H = 852;

// Spring that gives one visible overshoot bounce — same recipe as the tutorial
// overlay morph so the motion language stays consistent across the onboarding.
const CARD_SPRING  = { damping: 16, stiffness: 160, mass: 0.85 } as const;
const CLOSE_SPRING = { damping: 20, stiffness: 220, mass: 0.85 } as const;

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.dot, i < step ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ClosetSetupScreen() {
  const insets              = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  // Card geometry — Figma: left:19, top:108 on 852 frame
  const cardTop    = Math.round((108 / FIGMA_H) * screenH);
  const cardBottom = insets.bottom + 16;

  // ── Spring animation ──────────────────────────────────────────────────────
  const cardScale   = useSharedValue(0.04);
  const cardOpacity = useSharedValue(0);

  // Mount: spring the card from a tiny dot to full size
  useEffect(() => {
    cardScale.value   = withSpring(1, CARD_SPRING);
    cardOpacity.value = withSpring(1, { damping: 18, stiffness: 220 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity:   cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goNext = () => router.push('/(onboarding)/camera-scan' as any);

  const handleConfirm = () => {
    // Collapse card before leaving
    cardScale.value   = withSpring(0.04, CLOSE_SPRING, (done) => {
      'worklet';
      if (done) runOnJS(goNext)();
    });
    cardOpacity.value = withSpring(0, { damping: 20, stiffness: 300 });
  };

  return (
    <View style={s.root}>
      <SkyBackground cloudPosition="top">

        {/* ── Top bar — Figma: progress dots (step 4) + skip ─────── */}
        <View style={[s.topBar, { top: insets.top + 8 }]}>
          <ProgressDots step={4} total={4} />
          <Pressable hitSlop={12} onPress={() => router.replace('/(tabs)')}>
            <Text style={s.skip}>SKIP</Text>
          </Pressable>
        </View>

        {/* ── Tutorial card ─────────────────────────────────────── */}
        {/* Positioned at Figma top:108, fills remaining height.    */}
        {/* Animated.View handles scale spring; card itself is pure  */}
        {/* layout so the content doesn't jitter during the bounce.  */}
        <Animated.View
          style={[
            s.cardWrap,
            { top: cardTop, bottom: cardBottom },
            cardAnimStyle,
          ]}
        >
          <ClosetTutorialCard onConfirm={handleConfirm} />
        </Animated.View>

      </SkyBackground>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position:       'absolute',
    left:           20, right: 20,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    zIndex:         10,
  },
  skip: { ...Typography.caption, color: Colors.surface[150] },

  // ── Progress dots — 9×9, gap 3 ───────────────────────────────────────────
  dots:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:    { width: 9, height: 9, borderRadius: 5 },
  dotOn:  { backgroundColor: Colors.surface[200] },
  dotOff: { backgroundColor: 'rgba(43,30,30,0.18)' },

  // ── Card wrapper — fills screen between cardTop and bottom safe area ──────
  // left/right match Figma (19px each side)
  cardWrap: {
    position: 'absolute',
    left:     19,
    right:    19,
  },
});
