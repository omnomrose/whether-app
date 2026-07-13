/**
 * NavBar — Figma node 653:78 "nav bar"
 *
 * Floating solid pill fixed at the bottom of the screen (no glass/blur —
 * the app's design system dropped glass UI entirely).
 * Three buttons (Closet · Camera · Home) with a solid indicator that
 * springs to the active icon.
 *
 * Usage
 *   <NavBar activeTab={2} />
 *   activeTab: 0 = Closet · 1 = Camera (pushes scan flow) · 2 = Home/Weather
 *
 * zIndex 55 — sits above the tutorial overlay (50) and floating
 * closet button (52) in location-set.tsx.
 */

import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClosetIcon, CameraIcon, CloudIcon } from '@/components/NavIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

// ─── Pill geometry (Figma 653:78: w:153, h:43, icons at x:20/67/114) ──────────
const PILL_W      = 153;
const PILL_H      = 43;
const PILL_PX     = 8;
const SECTION_W   = (PILL_W - PILL_PX * 2) / 3;   // ≈ 45.7
const IND_W       = 38;
const IND_H       = 31;

/** X offset of the indicator from the pill's left edge for tab i */
function indLeft(i: number): number {
  return Math.round(PILL_PX + SECTION_W * i + (SECTION_W - IND_W) / 2);
}

// ─── Spring config — single overshoot gives the "morph" bounce ───────────────
const MORPH = { damping: 16, stiffness: 220, mass: 0.75 } as const;

// ─── Tab definitions ──────────────────────────────────────────────────────────
// Left→right order matches Figma 653:78: closet grid, camera, weather cloud.
// Camera is NOT a tab — it pushes the camera screen directly over everything.
// The closet-setup tutorial (Figma 144:68) is onboarding-only and is NOT
// shown here; it lives solely in the onboarding flow.
const TABS = [
  { label: 'Closet', Icon: ClosetIcon, href: '/(tabs)/closet',            push: false },
  { label: 'Scan',   Icon: CameraIcon, href: '/(onboarding)/camera-scan?mode=quick', push: true  },
  { label: 'Home',   Icon: CloudIcon,  href: '/(tabs)/',                  push: false },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  activeTab: 0 | 1 | 2;
}

export default function NavBar({ activeTab }: Props) {
  const insets = useSafeAreaInsets();

  // ── Animated indicator position ───────────────────────────────────────────
  const indX    = useSharedValue(indLeft(activeTab));
  const indScX  = useSharedValue(1);  // horizontal squash/stretch

  useEffect(() => {
    const target = indLeft(activeTab);
    // Brief stretch in the travel direction, then spring to target
    indX.value  = withSpring(target, MORPH);
    indScX.value = withSequence(
      withTiming(1.18, { duration: 90 }),
      withSpring(1,    { damping: 14, stiffness: 320 }),
    );
  }, [activeTab]);

  const indStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indX.value },
      { scaleX: indScX.value },
    ],
  }));

  return (
    <View
      style={[s.wrap, { bottom: insets.bottom + 10 }]}
      pointerEvents="box-none"
    >
      {/* ── Solid pill — surface-100, 1px surface-200 border ─────── */}
      <View style={s.pill}>

        {/* ── Morphing solid indicator ─────────────────────────── */}
        <Animated.View style={[s.indicator, indStyle]} pointerEvents="none" />

        {/* ── Icon buttons — sit above indicator (zIndex 2) ──── */}
        <View style={s.iconsRow} pointerEvents="box-none">
          {TABS.map((tab, i) => {
            const isActive = i === activeTab;
            return (
              <Pressable
                key={tab.label}
                style={s.iconBtn}
                hitSlop={10}
                onPress={() =>
                  tab.push
                    ? router.push(tab.href as any)
                    : router.navigate(tab.href as any)
                }
                accessibilityLabel={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                {/* Figma 653:78 — exact design icons, 19px wide */}
                <tab.Icon
                  size={19}
                  color={isActive ? Colors.surface[200] : Colors.surface[150]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Absolute container — centred horizontally, floats at bottom
  wrap: {
    position:   'absolute',
    left:       0,
    right:      0,
    alignItems: 'center',
    zIndex:     55,
  },

  // Solid pill — surface-100 bg, surface-200 border, radius 30, shadow-card
  pill: {
    width:           PILL_W,
    height:          PILL_H,
    borderRadius:    30,
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    backgroundColor: Colors.surface[100],
    overflow:        'hidden',
    shadowColor:     '#1d1d1d',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.09,
    shadowRadius:    14,
    elevation:       8,
  },

  // Solid indicator — subtle surface tint, springs between tabs
  indicator: {
    position:        'absolute',
    top:             (PILL_H - IND_H) / 2,
    left:            0,
    width:           IND_W,
    height:          IND_H,
    borderRadius:    17,
    backgroundColor: Colors.surface[10],
    zIndex:          1,
  },

  // Row of tappable icon buttons — lays out on top of indicator (zIndex 2)
  iconsRow: {
    position:          'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: PILL_PX,
    zIndex:            2,
  },

  iconBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
