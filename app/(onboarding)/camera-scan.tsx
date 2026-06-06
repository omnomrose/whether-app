// Figma nodes 144:90 / 144:305 / 144:336 — "onboard | scan top #1/#2/#3"
//
// This version adds:
//   • Glass bottom control bar (LinearGradient pill — project glass-linear recipe)
//   • Flash pill centred above the shutter ("on top of" the shutter)
//   • Conditional hint pill — shown via timer, not always visible (annotation 372:109)
//   • Tap-to-focus: brackets hidden until user taps OR 1.5s auto-detect
//   • Reanimated spring for focus frame in/out
//
// Capture flow (annotation 144:100 — "front picture then back picture"):
//   3 tops × 2 sides = 6 captures. Dot fills solid after both shots per top.

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  PanResponder,
  GestureResponderEvent,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';

// ─── Figma frame reference (393 × 852) ────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Per-step prompts ─────────────────────────────────────────────────────────
// [front, back] for each of the 3 tops.
const STEP_PROMPTS: readonly [string, string][] = [
  ['FIND THREE TOPS THAT ARE IN YOUR ROTATION', 'FLIP IT OVER — SNAP THE BACK'],
  ['SNAP 2 MORE TOPS FROM YOUR ROTATION',       'FLIP IT OVER — SNAP THE BACK'],
  ['ADD ANOTHER TOP FROM YOUR ROTATION',        'FLIP IT OVER — SNAP THE BACK'],
] as const;

const TOTAL_TOPS = 3;

// ─── Design constants ──────────────────────────────────────────────────────────
const BRACKET_ARM   = 28;    // L-corner arm length (px)
const BRACKET_THICK = 2.5;   // L-corner border width
const BRACKET_COLOR = 'rgba(255,255,255,0.90)';
const SHUTTER_OUTER = 72;    // Figma Ellipse6
const SHUTTER_INNER = 49;    // Figma Ellipse7
const THUMB_SIZE    = 35;    // thumbnail square
const BAR_H         = 90;    // glass bottom bar height
const FLASH_W       = 80;    // flash pill width
const FLASH_H       = 30;    // flash pill height

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function CameraScanScreen() {
  const insets                          = useSafeAreaInsets();
  const { width: sw, height: sh }       = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef                       = useRef<CameraView>(null);

  // ── Capture state ──────────────────────────────────────────────────────────
  const [topIndex,  setTopIndex]  = useState<0 | 1 | 2>(0);
  const [side,      setSide]      = useState<'front' | 'back'>('front');
  const [photos,    setPhotos]    = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [zoom,      setZoom]      = useState(0);

  // ── Focus frame ────────────────────────────────────────────────────────────
  // null = hidden; {x,y} = centred on that screen point.
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusOpacity = useSharedValue(0);
  const focusScale   = useSharedValue(1.2);

  // ── Conditional hint ───────────────────────────────────────────────────────
  // Fires 2.5 s after each step; auto-hides after 5 s.
  const hintOpacity  = useSharedValue(0);
  const hintTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Pinch-zoom refs ────────────────────────────────────────────────────────
  const zoomRef     = useRef(0);
  const prevDistRef = useRef(0);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sx = (x: number) => Math.round((x / FW) * sw);
  const sy = (y: number) => Math.round((y / FH) * sh);

  // ── Layout anchors (Figma state 1 as reference) ────────────────────────────
  const barBottom   = insets.bottom + 20;
  const gradH       = sy(99) + insets.top;          // top gradient height
  const promptTop   = sy(41) + insets.top;
  const dotsTop     = sy(51) + insets.top;
  const hintBottom  = barBottom + BAR_H + 24;       // above glass bar
  const hintW       = Math.min(sx(231), sw - 48);
  // Flash pill: centred horizontally, overlaps bar top by ~12 px
  const flashBottom = barBottom + BAR_H - 12;
  const flashLeft   = Math.round((sw - FLASH_W) / 2);
  // Focus frame size (Figma viewfinder: 81→304 wide, 218→511 tall)
  const focusW      = Math.round(sw * (223 / FW));
  const focusH      = Math.round(sh * (293 / FH));

  // ── Auto "detect subject" — simulates camera locking onto clothing ──────────
  // Shows focus brackets at screen centre 1.5 s after permission is granted,
  // matching annotation: "camera frame focuses on subject".
  useEffect(() => {
    if (!permission?.granted) return;
    const t = setTimeout(() => {
      // Only auto-show if user hasn't already tapped to focus
      setFocusPoint((prev) => {
        if (prev) return prev;
        return { x: sw / 2, y: sh * 0.42 };
      });
      focusScale.value   = 1.18;
      focusOpacity.value = withTiming(1, { duration: 300 });
      focusScale.value   = withSpring(1, { damping: 16, stiffness: 200, mass: 0.8 });
    }, 1500);
    return () => clearTimeout(t);
  }, [permission?.granted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hint timer — restarts on each step change ──────────────────────────────
  // Annotation 372:109: "show this message if it's too dark/unclear
  // where the clothing item is." → shown briefly as a nudge each step.
  useEffect(() => {
    clearTimeout(hintTimer.current);
    hintOpacity.value = withTiming(0, { duration: 100 });
    hintTimer.current = setTimeout(() => {
      hintOpacity.value = withSequence(
        withTiming(1, { duration: 350 }),
        withTiming(1, { duration: 4500 }),
        withTiming(0, { duration: 350 }),
      );
    }, 2500);
    return () => clearTimeout(hintTimer.current);
  }, [topIndex, side]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tap-to-focus ────────────────────────────────────────────────────────────
  const handleCameraTap = useCallback((e: GestureResponderEvent) => {
    const { pageX: x, pageY: y } = e.nativeEvent;
    setFocusPoint({ x, y });
    focusScale.value   = 1.18;
    focusOpacity.value = withTiming(1, { duration: 120 });
    focusScale.value   = withSpring(1, { damping: 18, stiffness: 230, mass: 0.75 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pinch-to-zoom ───────────────────────────────────────────────────────────
  const pinchResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        (e) => e.nativeEvent.touches.length === 2,
      onStartShouldSetPanResponderCapture: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder:         (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponderCapture:  (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        const ts = e.nativeEvent.touches;
        if (ts.length >= 2)
          prevDistRef.current = Math.hypot(
            ts[1].pageX - ts[0].pageX, ts[1].pageY - ts[0].pageY,
          );
      },
      onPanResponderMove: (e) => {
        const ts = e.nativeEvent.touches;
        if (ts.length < 2) return;
        const dist  = Math.hypot(ts[1].pageX - ts[0].pageX, ts[1].pageY - ts[0].pageY);
        if (prevDistRef.current > 0) {
          const delta   = (dist - prevDistRef.current) / (sw * 0.4);
          const newZoom = Math.max(0, Math.min(1, zoomRef.current + delta));
          zoomRef.current = newZoom;
          setZoom(newZoom);
        }
        prevDistRef.current = dist;
      },
      onPanResponderRelease:   () => { prevDistRef.current = 0; },
      onPanResponderTerminate: () => { prevDistRef.current = 0; },
    })
  ).current;

  // ── Capture ─────────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    // Shutter flash: briefly dim the focus frame
    focusOpacity.value = withSequence(
      withTiming(0.2, { duration: 60 }),
      withTiming(1,   { duration: 120 }),
    );
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const uri    = result?.uri ?? '';
      setPhotos((prev) => [...prev, uri]);
      if (side === 'front') {
        setSide('back');
      } else {
        const next = topIndex + 1;
        if (next >= TOTAL_TOPS) {
          setTimeout(() => router.replace('/(tabs)'), 200);
        } else {
          setTopIndex(next as 0 | 1 | 2);
          setSide('front');
          // Reset focus frame for next top
          focusOpacity.value = withTiming(0, { duration: 250 });
          setTimeout(() => setFocusPoint(null), 300);
        }
      }
    } finally {
      setCapturing(false);
    }
  }, [capturing, side, topIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Animated styles ─────────────────────────────────────────────────────────
  const focusFrameStyle = useAnimatedStyle(() => ({
    opacity:   focusOpacity.value,
    transform: [{ scale: focusScale.value }],
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));

  // ── Permission loading ───────────────────────────────────────────────────────
  if (!permission) return <View style={s.root} />;

  // ── Permission not granted ───────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.gradient.clearSky.colors[0] }}>
        <SkyBackground>
          <View style={[s.permWrap, {
            paddingTop:    insets.top + 40,
            paddingBottom: insets.bottom + 40,
          }]}>
            <View style={s.permCard}>
              <Text style={s.permTitle}>Your camera, your closet</Text>
              <Text style={s.permBody}>
                whether uses your camera to photograph your clothes and build a digital
                closet — so we can suggest outfits you actually own.
              </Text>
              <Pressable style={s.permBtn} onPress={requestPermission}>
                <Text style={s.permBtnText}>ALLOW CAMERA ACCESS</Text>
              </Pressable>
            </View>
          </View>
        </SkyBackground>
      </View>
    );
  }

  const lastPhoto = photos[photos.length - 1] ?? null;
  const prompt    = STEP_PROMPTS[topIndex][side === 'front' ? 0 : 1];

  return (
    <View style={s.root} {...pinchResponder.panHandlers}>

      {/* ── Live camera — full screen ──────────────────────────────────── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        zoom={zoom}
        flash={flashMode}
      />

      {/* ── Tap-to-focus touch surface (camera area only, above bar) ───── */}
      {/* Covers screen excluding glass bar + flash pill area.             */}
      <Pressable
        style={[s.cameraArea, { bottom: barBottom + BAR_H + 16 }]}
        onPress={handleCameraTap}
        accessibilityLabel="Tap to focus"
      />

      {/* ── Top gradient — Figma 392:145, surface-100 → transparent ──────── */}
      <LinearGradient
        colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.topGrad, { height: gradH }]}
        pointerEvents="none"
      />

      {/* ── Prompt text — Figma body-sm, left:20, top:41 ─────────────────── */}
      <Text style={[s.prompt, { top: promptTop }]}>{prompt}</Text>

      {/* ── Side badge — FRONT (primary) / BACK (neutral) ────────────────── */}
      <View style={[
        s.sideBadge,
        side === 'back' && s.sideBadgeBack,
        { top: promptTop + 42 },
      ]}>
        <Text style={s.sideBadgeText}>{side === 'front' ? 'FRONT' : 'BACK'}</Text>
      </View>

      {/* ── Progress dots — top right ─────────────────────────────────────── */}
      {/* complete (i < topIndex): filled ● — both shots done               */}
      {/* active   (i === topIndex): ring  ○ — currently shooting           */}
      {/* future   (i > topIndex): faint ring — not started                 */}
      <View style={[s.dotsRow, { top: dotsTop }]}>
        {([0, 1, 2] as const).map((i) => {
          const complete = i < topIndex;
          const active   = i === topIndex;
          return (
            <View key={i} style={[
              s.dot,
              complete ? s.dotComplete : active ? s.dotActive : s.dotFuture,
            ]}>
              {complete && (
                <Ionicons name="checkmark" size={10} color={Colors.surface[100]} />
              )}
            </View>
          );
        })}
      </View>

      {/* ── Focus frame — hidden until tap or auto-detect (1.5 s) ─────────── */}
      {/* Annotation: "camera frame focuses on subject"                      */}
      {/* Brackets spring in; centred on focusPoint.                        */}
      {focusPoint && (
        <Animated.View
          style={[
            s.focusFrame,
            {
              left:  focusPoint.x - focusW / 2,
              top:   focusPoint.y - focusH / 2,
              width: focusW,
              height: focusH,
            },
            focusFrameStyle,
          ]}
          pointerEvents="none"
        >
          <View style={[s.bracket, s.bTL]} />
          <View style={[s.bracket, s.bTR]} />
          <View style={[s.bracket, s.bBL]} />
          <View style={[s.bracket, s.bBR]} />
        </Animated.View>
      )}

      {/* ── Hint pill — conditional, centred above bar ────────────────────── */}
      {/* Annotation 372:109: "show if too dark/unclear where item is".     */}
      {/* Fades in 2.5 s after each step, auto-hides after 5 s.            */}
      <Animated.View
        style={[
          s.hintPill,
          { bottom: hintBottom, left: (sw - hintW) / 2, width: hintW },
          hintStyle,
        ]}
        pointerEvents="none"
      >
        <Text style={s.hintText}>
          ENSURE ITEM IS LAYING FLAT ON A SOLID BACKGROUND AND CENTRED
        </Text>
      </Animated.View>

      {/* ── Flash pill — centred, overlaps top of glass bar ────────────────── */}
      {/* "Flash icon can be shown on top of the camera shutter"            */}
      {/* Glass-linear pill consistent with the project's design system.   */}
      <Pressable
        style={[s.flashPill, { bottom: flashBottom, left: flashLeft }]}
        onPress={() => setFlashMode((m) => (m === 'off' ? 'on' : 'off'))}
        hitSlop={10}
        accessibilityLabel={flashMode === 'off' ? 'Turn flash on' : 'Turn flash off'}
      >
        {/* Glass inner gradient */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.flashGrad}
          pointerEvents="none"
        />
        <Ionicons
          name={flashMode === 'on' ? 'flash' : 'flash-off'}
          size={13}
          color={flashMode === 'on' ? '#c9a800' : Colors.surface[150]}
        />
        <Text style={[s.flashLabel, flashMode === 'on' && s.flashLabelOn]}>
          {flashMode === 'on' ? 'ON' : 'OFF'}
        </Text>
      </Pressable>

      {/* ── Glass bottom control bar ──────────────────────────────────────── */}
      {/* Project glass-linear recipe: LinearGradient outer + white rim.   */}
      {/* Layout: [thumb] [shutter] [counter]                              */}
      <LinearGradient
        colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={[s.bottomBar, { bottom: barBottom }]}
      >
        {/* Specular rim — 1 px bright line at top of pill */}
        <View style={s.barRim} pointerEvents="none" />

        <View style={s.barRow}>

          {/* Left — thumbnail stack (Annotation 144:103: tappable to review) */}
          <Pressable
            style={s.thumbArea}
            disabled={photos.length === 0}
            onPress={() => { /* TODO: open review/retake sheet */ }}
            accessibilityLabel={photos.length > 0 ? 'Review your photos' : undefined}
          >
            <View style={s.thumbContainer}>
              <View style={s.thumbBack} />
              {lastPhoto ? (
                <Image source={{ uri: lastPhoto }} style={s.thumbFront} />
              ) : (
                <View style={s.thumbFront} />
              )}
            </View>
          </Pressable>

          {/* Centre — shutter button */}
          <Pressable
            style={s.shutterOuter}
            onPress={handleCapture}
            disabled={capturing}
            hitSlop={6}
            accessibilityLabel={`Take ${side} photo of top ${topIndex + 1}`}
          >
            <View style={[s.shutterInner, capturing && s.shutterCapturing]} />
          </Pressable>

          {/* Right — step counter (Figma: "1" / "2" / "3") */}
          <View style={s.counterArea}>
            <Text style={s.countLabel}>{topIndex + 1}</Text>
          </View>

        </View>
      </LinearGradient>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // ── Tap-to-focus Pressable (camera area only) ──────────────────────────────
  cameraArea: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    // bottom set dynamically (above bar)
  },

  // ── Top gradient ────────────────────────────────────────────────────────────
  // Figma 392:145: 99 px surface-100 → transparent from top.
  topGrad: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 5,
  },

  // ── Prompt text ─────────────────────────────────────────────────────────────
  // Figma body-sm: Public Sans Regular 14/18, ls -0.28, surface-200.
  prompt: {
    position:      'absolute',
    left:          20,
    width:         169,
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    zIndex:        10,
  },

  // ── Side badge ──────────────────────────────────────────────────────────────
  sideBadge: {
    position:          'absolute',
    left:              20,
    backgroundColor:   Colors.primary[100],
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      50,
    zIndex:            10,
  },
  sideBadgeBack: {
    backgroundColor: Colors.surface[30],
  },
  sideBadgeText: {
    fontFamily:    FontFamily.sansMedium,
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // ── Progress dots ────────────────────────────────────────────────────────────
  dotsRow: {
    position:      'absolute',
    right:         20,
    flexDirection: 'row',
    gap:           6,
    zIndex:        10,
  },
  dot: {
    width:          18,
    height:         18,
    borderRadius:   9,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dotComplete: { backgroundColor: Colors.surface[200] },
  dotActive:   {
    backgroundColor: 'transparent',
    borderWidth:     2,
    borderColor:     Colors.surface[200],
  },
  dotFuture: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     'rgba(43,30,30,0.22)',
  },

  // ── Focus frame ──────────────────────────────────────────────────────────────
  focusFrame: {
    position: 'absolute',
    zIndex:   6,
  },
  bracket: { position: 'absolute', width: BRACKET_ARM, height: BRACKET_ARM },
  bTL: { top: 0,    left:  0, borderTopWidth: BRACKET_THICK,    borderLeftWidth:  BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bTR: { top: 0,    right: 0, borderTopWidth: BRACKET_THICK,    borderRightWidth: BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bBL: { bottom: 0, left:  0, borderBottomWidth: BRACKET_THICK, borderLeftWidth:  BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICK, borderRightWidth: BRACKET_THICK,  borderColor: BRACKET_COLOR },

  // ── Hint pill ────────────────────────────────────────────────────────────────
  // Figma 392:139: surface-100 bg, radius 24, p:10.
  // Conditional — shown/hidden via hintOpacity SharedValue.
  hintPill: {
    position:          'absolute',
    backgroundColor:   Colors.surface[100],
    borderRadius:      24,
    paddingVertical:   10,
    paddingHorizontal: 14,
    alignItems:        'center',
    zIndex:            10,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.06,
    shadowRadius:      8,
    elevation:         3,
  },
  hintText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    textAlign:     'center',
    color:         Colors.surface[150],
  },

  // ── Flash pill ───────────────────────────────────────────────────────────────
  // Small glass-linear pill that floats centred just above the bottom bar,
  // overlapping the bar's top edge ("on top of the camera shutter").
  flashPill: {
    position:        'absolute',
    width:           FLASH_W,
    height:          FLASH_H,
    borderRadius:    FLASH_H / 2,
    backgroundColor: Colors.surface[100],
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.75)',
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             5,
    zIndex:          15,
    overflow:        'hidden',
    shadowColor:     '#1d1d1d',
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.08,
    shadowRadius:    6,
    elevation:       4,
  },
  // Top specular gloss inside the flash pill
  flashGrad: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FLASH_H / 2,
  },
  flashLabel: {
    fontFamily:    FontFamily.sansMedium,
    fontSize:      9,
    lineHeight:    12,
    letterSpacing: -0.1,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  flashLabelOn: {
    color: '#c9a800',
  },

  // ── Glass bottom control bar ─────────────────────────────────────────────────
  // Same glass-linear recipe as GlassNavBar: LinearGradient outer container
  // (surface-100 → transparent, bottom → top) + 1 px white rim + shadow.
  bottomBar: {
    position:      'absolute',
    left:          20,
    right:         20,
    height:        BAR_H,
    borderRadius:  28,
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.72)',
    overflow:      'hidden',
    shadowColor:   '#1d1d1d',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
    elevation:     8,
    zIndex:        14,
  },
  // 1 px bright specular at the top of the pill (like GlassNavBar pillRim)
  barRim: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    zIndex:          3,
  },
  barRow: {
    flex:             1,
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: 16,
    zIndex:           2,
  },

  // ── Thumbnail area (left 1/3 of bar) ─────────────────────────────────────────
  thumbArea: {
    flex:           1,
    alignItems:     'flex-start',
    justifyContent: 'center',
  },
  // Sized container so the rotated back thumb doesn't overflow layout
  thumbContainer: {
    width:  THUMB_SIZE + 10,
    height: THUMB_SIZE + 10,
  },
  thumbBack: {
    position:        'absolute',
    top:             5,
    left:            0,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    backgroundColor: Colors.surface[30],
    borderRadius:    3,
    transform:       [{ rotate: '14.67deg' }],
  },
  thumbFront: {
    position:        'absolute',
    top:             5,
    left:            0,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    backgroundColor: Colors.surface[20],
    borderRadius:    3,
    overflow:        'hidden',
  },

  // ── Shutter button (centre of bar) ───────────────────────────────────────────
  // Figma: Ellipse6 (72 px outer ring) + Ellipse7 (49 px solid inner).
  shutterOuter: {
    width:          SHUTTER_OUTER,
    height:         SHUTTER_OUTER,
    borderRadius:   SHUTTER_OUTER / 2,
    borderWidth:    3,
    borderColor:    'rgba(255,255,255,0.85)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width:           SHUTTER_INNER,
    height:          SHUTTER_INNER,
    borderRadius:    SHUTTER_INNER / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  shutterCapturing: { opacity: 0.50 },

  // ── Counter (right 1/3 of bar) ────────────────────────────────────────────────
  counterArea: {
    flex:           1,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  countLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    color:         Colors.surface[150],
    textTransform: 'uppercase',
  },

  // ── Permission card ───────────────────────────────────────────────────────────
  permWrap: {
    flex:              1,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 20,
  },
  permCard: {
    backgroundColor: Colors.surface[100],
    borderRadius:    24,
    padding:         28,
    gap:             20,
    alignItems:      'center',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       6,
  },
  permTitle: {
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         Colors.surface[200],
    textAlign:     'center',
  },
  permBody: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    20,
    letterSpacing: -0.28,
    color:         Colors.surface[150],
    textAlign:     'center',
  },
  permBtn: {
    backgroundColor:   Colors.primary[100],
    paddingHorizontal: 24,
    paddingVertical:   10,
    borderRadius:      50,
    alignSelf:         'center',
  },
  permBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
});
