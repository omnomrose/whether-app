// Figma nodes 144:90 / 144:305 / 144:336 — "onboard | scan clothing"
//
// Flow: 3 tops → 2 bottoms → 1 shoes (front-only, 6 captures total).
//
// After each capture:
//   • Photo stored immediately → camera stays on screen, advances to next step
//   • removeBackground() fires in the background (non-blocking)
//   • Thumbnail shows loading indicator while API processes
//   • When all 6 are captured → auto-navigate to photo-confirm for review
//
// Photo-confirm ONLY opens from:
//   a) Thumbnail tap (review / retake any time)
//   b) Automatically when all 6 shots are taken

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
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
import { useScanStore, SCAN_STEPS } from '@/store/scanStore';
import { removeBackground } from '@/lib/photoroom';

// ─── Figma frame reference (393 × 852) ────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Design constants ──────────────────────────────────────────────────────────
const BRACKET_ARM   = 28;
const BRACKET_THICK = 2.5;
const BRACKET_COLOR = 'rgba(255,255,255,0.90)';
const SHUTTER_OUTER = 72;
const SHUTTER_INNER = 49;
const THUMB_SIZE    = 35;
const BAR_H         = 90;

// Category badge colours
const CATEGORY_COLORS: Record<string, string> = {
  top:    Colors.primary[100],
  bottom: Colors.surface[30],
  shoes:  Colors.surface[150],
};

export default function CameraScanScreen() {
  const insets  = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // ── Scan store ─────────────────────────────────────────────────────────────
  const {
    stepIndex,
    photos,
    addCapture,
    setBgRemoved,
    setBgError,
    setProcessing,
  } = useScanStore();

  const allCaptured = stepIndex >= SCAN_STEPS.length;   // all 6 shots taken

  // ── Local camera state ─────────────────────────────────────────────────────
  const [capturing, setCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [zoom,      setZoom]      = useState(0);

  // ── Focus frame ────────────────────────────────────────────────────────────
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusOpacity = useSharedValue(0);
  const focusScale   = useSharedValue(1.2);

  // ── Conditional hint ───────────────────────────────────────────────────────
  const hintOpacity = useSharedValue(0);
  const hintTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Pinch-zoom refs ────────────────────────────────────────────────────────
  const zoomRef     = useRef(0);
  const prevDistRef = useRef(0);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const sx = (x: number) => Math.round((x / FW) * sw);
  const sy = (y: number) => Math.round((y / FH) * sh);

  // ── Layout anchors ─────────────────────────────────────────────────────────
  const barBottom  = insets.bottom + 20;
  const gradH      = sy(99) + insets.top;
  const promptTop  = sy(68) + insets.top;
  const dotsTop    = sy(78) + insets.top;
  const hintBottom = barBottom + BAR_H + 24;
  const hintW      = Math.min(sx(231), sw - 48);
  const focusW     = Math.round(sw * (223 / FW));
  const focusH     = Math.round(sh * (293 / FH));

  // ── Current step data ──────────────────────────────────────────────────────
  const safeStep    = Math.min(stepIndex, SCAN_STEPS.length - 1);
  const currentStep = SCAN_STEPS[safeStep];

  const allInCategory = SCAN_STEPS
    .map((s, i) => ({ ...s, i }))
    .filter((s) => s.category === currentStep.category);
  const categoryStartIdx = allInCategory[0]?.i ?? 0;
  const indexInCategory  = safeStep - categoryStartIdx;
  const totalInCategory  = allInCategory.length;

  // ── Thumbnail derived values ───────────────────────────────────────────────
  const capturedCount   = photos.length;
  const lastPhoto       = capturedCount > 0 ? photos[capturedCount - 1] : null;
  const lastPhotoUri    = lastPhoto?.bgRemovedUri ?? lastPhoto?.rawUri ?? null;
  const anyProcessing   = photos.some((p) => p.isProcessing);
  const lastError       = photos.findLast((p) => p.bgError)?.bgError ?? null;

  // ── When all 6 shots done → open photo-confirm automatically ───────────────
  useEffect(() => {
    if (allCaptured && capturedCount === SCAN_STEPS.length) {
      // Brief delay so the last thumbnail animates before navigating
      const t = setTimeout(() => router.push('/(onboarding)/photo-confirm'), 350);
      return () => clearTimeout(t);
    }
  }, [allCaptured, capturedCount]);

  // ── Auto "detect subject" ──────────────────────────────────────────────────
  useEffect(() => {
    if (!permission?.granted) return;
    const t = setTimeout(() => {
      setFocusPoint((prev) => prev ?? { x: sw / 2, y: sh * 0.42 });
      focusScale.value   = 1.18;
      focusOpacity.value = withTiming(1, { duration: 300 });
      focusScale.value   = withSpring(1, { damping: 16, stiffness: 200, mass: 0.8 });
    }, 1500);
    return () => clearTimeout(t);
  }, [permission?.granted]); // eslint-disable-line

  // ── Hint timer ─────────────────────────────────────────────────────────────
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
  }, [stepIndex]); // eslint-disable-line

  // ── Tap-to-focus ────────────────────────────────────────────────────────────
  const handleCameraTap = useCallback((e: GestureResponderEvent) => {
    const { pageX: x, pageY: y } = e.nativeEvent;
    setFocusPoint({ x, y });
    focusScale.value   = 1.18;
    focusOpacity.value = withTiming(1, { duration: 120 });
    focusScale.value   = withSpring(1, { damping: 18, stiffness: 230, mass: 0.75 });
  }, []); // eslint-disable-line

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
        const dist = Math.hypot(ts[1].pageX - ts[0].pageX, ts[1].pageY - ts[0].pageY);
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

  // ── Capture — store photo immediately, fire BG removal in background ────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || allCaptured) return;
    setCapturing(true);
    focusOpacity.value = withSequence(
      withTiming(0.2, { duration: 60 }),
      withTiming(1,   { duration: 120 }),
    );
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const uri    = result?.uri ?? '';
      if (!uri) return;

      // 1. Store photo + advance step (camera stays on screen)
      const photoId = addCapture(uri);

      // 2. Fire BG removal in background — non-blocking
      //    Thumbnail shows spinner while in flight; error badge if it fails.
      removeBackground(uri)
        .then((bgUri) => {
          setBgRemoved(photoId, bgUri);
          setBgError(photoId, null);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[camera-scan] removeBackground failed:', msg);
          setBgRemoved(photoId, null);   // fall back to rawUri
          setBgError(photoId, msg);
        })
        .finally(() => setProcessing(photoId, false));

    } finally {
      setCapturing(false);
    }
  }, [capturing, allCaptured, addCapture, setBgRemoved, setProcessing]); // eslint-disable-line

  // ── Animated styles ─────────────────────────────────────────────────────────
  const focusFrameStyle = useAnimatedStyle(() => ({
    opacity:   focusOpacity.value,
    transform: [{ scale: focusScale.value }],
  }));
  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));

  // ── Permission loading ───────────────────────────────────────────────────────
  if (!permission) return <View style={s.root} />;

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

  return (
    <View style={s.root} {...pinchResponder.panHandlers}>

      {/* ── Live camera ─────────────────────────────────────────────────── */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        zoom={zoom}
        flash={flashMode}
      />

      {/* ── Tap-to-focus surface ────────────────────────────────────────── */}
      <Pressable
        style={[s.cameraArea, { bottom: barBottom + BAR_H + 16 }]}
        onPress={handleCameraTap}
        accessibilityLabel="Tap to focus"
      />

      {/* ── Top gradient ────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.topGrad, { height: gradH }]}
        pointerEvents="none"
      />

      {/* ── Prompt ──────────────────────────────────────────────────────── */}
      <Text style={[s.prompt, { top: promptTop }]}>
        {allCaptured ? 'TAP YOUR PHOTOS TO REVIEW' : currentStep.prompt}
      </Text>

      {/* ── Category badge ─────────────────────────────────────────────── */}
      {!allCaptured && (
        <View style={[
          s.categoryBadge,
          { top: promptTop + 42, backgroundColor: CATEGORY_COLORS[currentStep.category] },
        ]}>
          <Text style={s.categoryBadgeText}>{currentStep.label}</Text>
        </View>
      )}

      {/* ── Progress dots ───────────────────────────────────────────────── */}
      {!allCaptured && (
        <View style={[s.dotsRow, { top: dotsTop }]}>
          {Array.from({ length: totalInCategory }).map((_, i) => {
            const complete = i < indexInCategory;
            const active   = i === indexInCategory;
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
      )}

      {/* ── Focus frame ─────────────────────────────────────────────────── */}
      {focusPoint && !allCaptured && (
        <Animated.View
          style={[
            s.focusFrame,
            {
              left:   focusPoint.x - focusW / 2,
              top:    focusPoint.y - focusH / 2,
              width:  focusW,
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

      {/* ── Hint pill ───────────────────────────────────────────────────── */}
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

      {/* ── Glass bottom control bar ─────────────────────────────────────── */}
      <LinearGradient
        colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={[s.bottomBar, { bottom: barBottom }]}
      >
        <View style={s.barRim} pointerEvents="none" />
        <View style={s.barRow}>

          {/* Left — Flash icon */}
          <Pressable
            style={s.flashArea}
            onPress={() => setFlashMode((m) => (m === 'off' ? 'on' : 'off'))}
            hitSlop={12}
            accessibilityLabel={flashMode === 'off' ? 'Turn flash on' : 'Turn flash off'}
          >
            <Ionicons
              name={flashMode === 'on' ? 'flash' : 'flash-off'}
              size={28}
              color={flashMode === 'on' ? '#c9a800' : Colors.surface[150]}
            />
          </Pressable>

          {/* Centre — Shutter (disabled once all captured) */}
          <Pressable
            style={[s.shutterOuter, allCaptured && s.shutterDone]}
            onPress={handleCapture}
            disabled={capturing || allCaptured}
            hitSlop={6}
            accessibilityLabel={allCaptured ? 'All photos taken' : `Take photo — ${currentStep.label}`}
          >
            <View style={[s.shutterInner, (capturing || allCaptured) && s.shutterCapturing]} />
          </Pressable>

          {/* Right — Photo confirmation thumbnail */}
          {/* Badge shows total captured; checkmark appears once any is taken */}
          <Pressable
            style={s.confirmArea}
            disabled={capturedCount === 0}
            onPress={() => router.push('/(onboarding)/photo-confirm')}
            accessibilityLabel={capturedCount > 0 ? 'Review your photos' : undefined}
          >
            <View style={s.thumbContainer}>
              <View style={s.thumbBack} />
              {lastPhotoUri ? (
                <Image source={{ uri: lastPhotoUri }} style={s.thumbFront} />
              ) : (
                <View style={s.thumbFront} />
              )}

              {/* Loading indicator while BG removal is in flight */}
              {anyProcessing && capturedCount > 0 && (
                <View style={s.thumbLoading}>
                  <ActivityIndicator size="small" color={Colors.surface[100]} />
                </View>
              )}

              {/* Error indicator — tap thumbnail to see full error in photo-confirm */}
              {!anyProcessing && lastError && (
                <View style={s.thumbError}>
                  <Ionicons name="warning" size={12} color="#ef4444" />
                </View>
              )}

              {/* Count badge */}
              {capturedCount > 0 && (
                <View style={s.countBadge}>
                  <Text style={s.countBadgeText}>{capturedCount}</Text>
                </View>
              )}
              {/* Checkmark */}
              {capturedCount > 0 && !anyProcessing && (
                <View style={s.checkmarkBadge}>
                  <Ionicons name="checkmark" size={8} color={Colors.surface[100]} />
                </View>
              )}
            </View>
          </Pressable>

        </View>
      </LinearGradient>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  cameraArea: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
  },

  topGrad: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 5,
  },

  prompt: {
    position:      'absolute',
    left:          20,
    width:         200,
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    zIndex:        10,
  },

  categoryBadge: {
    position:          'absolute',
    left:              20,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      50,
    zIndex:            10,
  },
  categoryBadgeText: {
    fontFamily:    FontFamily.sansMedium,
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

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
  dotActive: {
    backgroundColor: 'transparent',
    borderWidth:     2,
    borderColor:     Colors.surface[200],
  },
  dotFuture: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     'rgba(43,30,30,0.22)',
  },

  focusFrame: { position: 'absolute', zIndex: 6 },
  bracket: { position: 'absolute', width: BRACKET_ARM, height: BRACKET_ARM },
  bTL: { top: 0,    left:  0, borderTopWidth: BRACKET_THICK,    borderLeftWidth:  BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bTR: { top: 0,    right: 0, borderTopWidth: BRACKET_THICK,    borderRightWidth: BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bBL: { bottom: 0, left:  0, borderBottomWidth: BRACKET_THICK, borderLeftWidth:  BRACKET_THICK,  borderColor: BRACKET_COLOR },
  bBR: { bottom: 0, right: 0, borderBottomWidth: BRACKET_THICK, borderRightWidth: BRACKET_THICK,  borderColor: BRACKET_COLOR },

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
  barRim: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    zIndex:          3,
  },
  barRow: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    zIndex:            2,
  },

  flashArea: {
    flex:           1,
    alignItems:     'flex-start',
    justifyContent: 'center',
  },

  shutterOuter: {
    width:          SHUTTER_OUTER,
    height:         SHUTTER_OUTER,
    borderRadius:   SHUTTER_OUTER / 2,
    borderWidth:    3,
    borderColor:    'rgba(255,255,255,0.85)',
    alignItems:     'center',
    justifyContent: 'center',
  },
  shutterDone: {
    borderColor:     'rgba(255,255,255,0.30)',
  },
  shutterInner: {
    width:           SHUTTER_INNER,
    height:          SHUTTER_INNER,
    borderRadius:    SHUTTER_INNER / 2,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  shutterCapturing: { opacity: 0.30 },

  confirmArea: {
    flex:           1,
    alignItems:     'flex-end',
    justifyContent: 'center',
  },
  thumbContainer: {
    width:    THUMB_SIZE + 10,
    height:   THUMB_SIZE + 10,
    position: 'relative',
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
  // Spinner overlay while BG removal is in flight
  thumbLoading: {
    position:        'absolute',
    top:             5,
    left:            0,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    3,
    backgroundColor: 'rgba(43,30,30,0.45)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          3,
  },
  thumbError: {
    position:        'absolute',
    top:             -4,
    right:           -4,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: Colors.surface[100],
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          5,
  },
  countBadge: {
    position:        'absolute',
    top:             0,
    left:            -4,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.surface[200],
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          4,
  },
  countBadgeText: {
    fontFamily:    FontFamily.sans,
    fontSize:      7.68,
    lineHeight:    10,
    letterSpacing: -0.12,
    color:         '#d9d9d9',
  },
  checkmarkBadge: {
    position:        'absolute',
    top:             0,
    right:           -4,
    width:           14,
    height:          14,
    borderRadius:    7,
    backgroundColor: Colors.surface[200],
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          4,
  },

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
