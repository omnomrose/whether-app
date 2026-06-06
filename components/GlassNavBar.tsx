/**
 * GlassNavBar — Figma node 380:129 "nav bar"
 *
 * Floating glass pill fixed at the bottom of the screen.
 * Three tabs (Closet · Outfit · Home) with a BlurView indicator
 * that springs to the active icon, creating a "glass morphing" effect.
 *
 * Usage
 *   <GlassNavBar activeTab={2} />
 *   activeTab: 0 = Closet · 1 = Outfit · 2 = Home/Weather
 *
 * zIndex 55 — sits above the tutorial overlay (50) and floating
 * closet button (52) in location-set.tsx.
 */

import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

// ─── Pill geometry (Figma: w:230, px:12, py:4) ────────────────────────────────
const PILL_W      = 230;
const PILL_H      = 44;
const PILL_PX     = 12;
const SECTION_W   = (PILL_W - PILL_PX * 2) / 3;   // ≈ 68.67
const IND_W       = 52;
const IND_H       = 34;

/** X offset of the glass indicator from the pill's left edge for tab i */
function indLeft(i: number): number {
  return Math.round(PILL_PX + SECTION_W * i + (SECTION_W - IND_W) / 2);
}

// ─── Spring config — single overshoot gives the "morph" bounce ───────────────
const MORPH = { damping: 16, stiffness: 220, mass: 0.75 } as const;

// ─── Tab definitions ──────────────────────────────────────────────────────────
// Left→right order matches Figma: closet icon, add icon, weather icon.
const TABS = [
  { label: 'Closet', icon: 'apps-outline'         as const, href: '/(tabs)/closet'  },
  { label: 'Outfit', icon: 'add-circle-outline'   as const, href: '/(tabs)/outfit'  },
  { label: 'Home',   icon: 'partly-sunny-outline' as const, href: '/(tabs)/'        },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  activeTab: 0 | 1 | 2;
}

export default function GlassNavBar({ activeTab }: Props) {
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
      {/* ── Glass pill ──────────────────────────────────────────── */}
      <LinearGradient
        colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={s.pill}
      >
        {/* Top-edge specular rim */}
        <View style={s.pillRim} pointerEvents="none" />

        {/* ── Morphing BlurView indicator ──────────────────────── */}
        {/* Translates from one tab position to another via spring. */}
        {/* The scaleX stretch makes it feel like it's "flowing".   */}
        <Animated.View style={[s.indOuter, indStyle]} pointerEvents="none">
          <BlurView intensity={55} tint="light" style={s.indBlur}>
            {/* Top specular shine inside the indicator */}
            <View style={s.indShine} pointerEvents="none" />
          </BlurView>
          {/* White border rim on the indicator */}
          <View style={s.indBorder} pointerEvents="none" />
        </Animated.View>

        {/* ── Icon buttons — sit above indicator (zIndex 2) ──── */}
        <View style={s.iconsRow} pointerEvents="box-none">
          {TABS.map((tab, i) => {
            const isActive = i === activeTab;
            return (
              <Pressable
                key={tab.label}
                style={s.iconBtn}
                hitSlop={10}
                onPress={() => router.navigate(tab.href as any)}
                accessibilityLabel={tab.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={tab.icon}
                  size={isActive ? 24 : 21}
                  color={isActive ? Colors.surface[200] : Colors.surface[150]}
                />
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
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

  // Glass-linear pill — Figma: width 230, borderRadius 30, from-surface-100 to transparent
  pill: {
    width:        PILL_W,
    height:       PILL_H,
    borderRadius: 30,
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.72)',
    overflow:     'hidden',
    shadowColor:  '#1d1d1d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation:    8,
  },

  // Bright 1 px specular line at the very top of the pill
  pillRim: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    zIndex:          3,
  },

  // Animated wrapper for the BlurView indicator
  // Positioned at left:0; translateX moves it to the correct tab position.
  indOuter: {
    position:     'absolute',
    top:          (PILL_H - IND_H) / 2,
    left:         0,
    width:        IND_W,
    height:       IND_H,
    borderRadius: 17,
    overflow:     'hidden',
    zIndex:       1,
  },

  // Frosted glass fill inside the indicator
  indBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
  },

  // Top specular highlight inside the indicator
  indShine: {
    position:              'absolute',
    top: 0, left: 0, right: 0,
    height:                13,
    backgroundColor:       'rgba(255,255,255,0.42)',
    borderTopLeftRadius:   17,
    borderTopRightRadius:  17,
  },

  // Inset white border on the indicator (gives the glass edge)
  indBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    borderWidth:  1,
    borderColor:  'rgba(255,255,255,0.60)',
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
