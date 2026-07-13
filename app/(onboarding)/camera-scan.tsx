// Figma node 144:90 — "onboard | scan clothing #1"
//
// Annotations:
//   • Camera frame auto-focuses on subject (static bracket frame, centred)
//   • Ask for camera permission before proceeding
//   • Prompt text: "find three tops that are in your rotation" etc. (SCAN_STEPS)
//   • Hint pill shows if it's too dark/unclear ("ENSURE ITEM IS LAYING FLAT…")
//   • Photo confirmation thumbnail: tap → opens photo-confirm carousel
//   • Count badge + checkmark badge on thumbnail once photos exist
//
// Layout (Figma 393 × 852):
//   Background: surface-200 (#2b1e1e) — dark warm brown
//   Prompt:       left:20, top:68 → surface-100 text
//   Progress dots: top:77, right:20 → surface-100 colours on dark bg
//   Camera card:  left:20, top:124, w:353, h:601, r:16 — contained rounded viewfinder
//   Focus brackets: inside card at card-relative (61,94)→(253,388)
//   Hint pill:    inside card, top:527, w:292, surface-100 bg
//   Flash:        left:20, vertically centred in strip below card (~top:770)
//   Shutter:      centred H, top:752, outer:72 inner:57
//   Thumbnail:    right side, top:765

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
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

// ─── Design constants ─────────────────────────────────────────────────────────
const BRACKET_ARM   = 24;
const BRACKET_THICK = 2;
const BRACKET_COLOR = 'rgba(255,255,255,0.90)';
const SHUTTER_OUTER = 72;
const SHUTTER_INNER = 57;
const THUMB_SIZE    = 35;

// Camera card geometry from Figma (px in 393×852 frame, node 392:137)
const CARD_LEFT   = 20;
const CARD_TOP    = 124;
const CARD_W      = 353;
const CARD_H      = 616;

// Focus rect corners (Figma absolute → card-relative):
//   TL: screen(81,218) → card(61, 94)
//   BR: screen(273,512) → card(253,388)
const FOCUS_L  = 61;   // card-relative left of TL bracket
const FOCUS_T  = 94;   // card-relative top of TL bracket
const FOCUS_R  = CARD_W - 253;   // = 100 — from right of card to TR bracket
const FOCUS_B  = CARD_H - 388;   // = 213 — from bottom of card to BR bracket
const FOCUS_W  = 253 - FOCUS_L;  // = 192
const FOCUS_H  = 388 - FOCUS_T;  // = 294

// Hint pill (card-relative, Figma screen: left:51,top:609 → card: left:31,top:485)
// Node 392:139: screen top:609 − card top:124 = card-relative top:485
const HINT_L   = 31;
const HINT_TOP = 485;
const HINT_W   = 292;

// Bottom controls (Figma screen absolute, below card)
const FLASH_L      = 20;
const FLASH_TOP    = 770;
const SHUTTER_TOP  = 752;
const THUMB_L      = 318;   // left edge of thumbnail stack
const THUMB_TOP    = 765;

// Zoom levels — Figma 524:181 shows three buttons: 0.5, 1x (active, yellow), 2
// Expo Camera zoom is 0–1 (0 = minimum/widest, 1 = maximum).
// Calibrated to device feel: 0.02 = ultra-wide (0.5x), 0.12 = normal (1x), 0.50 = tele (2x).
const ZOOM_LEVELS = [
  { label: '0.5', activeLabel: '0.5x', value: 0.02 },
  { label: '1',   activeLabel: '1x',   value: 0.12 },
  { label: '2',   activeLabel: '2x',   value: 0.50 },
] as const;
const DEFAULT_ZOOM_IDX = 1; // "1x" (value 0.12) on open

// ─── Zoom button (Figma 524:181) ──────────────────────────────────────────────
function ZoomButton({
  label,
  activeLabel,
  isActive,
  onPress,
}: {
  label:       string;
  activeLabel: string;
  isActive:    boolean;
  onPress:     () => void;
}) {
  const scale = useSharedValue(isActive ? 1.18 : 1);
  useEffect(() => {
    scale.value = withTiming(isActive ? 1.18 : 1, { duration: 220, easing: Easing.inOut(Easing.ease) });
  }, [isActive]); // eslint-disable-line
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Animated.View style={[zb.btn, animStyle]}>
        <Text style={[zb.label, isActive && zb.labelActive]}>
          {isActive ? activeLabel : label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const zb = StyleSheet.create({
  btn: {
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: Colors.surface[10],   // rgba(43,30,30,0.1) per Figma
    alignItems:      'center',
    justifyContent:  'center',
  },
  label: {
    fontFamily:    FontFamily.sans,        // DM Mono Regular
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[100],
  },
  labelActive: { color: '#ffdb43' },
});

export default function CameraScanScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Scale helpers — Figma px → device px
  // Root view has paddingTop:insets.top so all sy() values are safe-area-relative.
  const sx = useCallback((x: number) => (x / FW) * sw, [sw]);
  const sy = useCallback((y: number) => (y / FH) * sh, [sh]);

  // ── Scan store ─────────────────────────────────────────────────────────────
  const {
    stepIndex,
    photos,
    completed,
    addCapture,
    setBgRemoved,
    setBgError,
    setProcessing,
    reset,
  } = useScanStore();

  // Reset if re-entering after a completed session (e.g. "RESCAN" button)
  useEffect(() => {
    if (completed) reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allCaptured = stepIndex >= SCAN_STEPS.length;

  // ── Local camera state ─────────────────────────────────────────────────────
  const [capturing,     setCapturing]     = useState(false);
  const [flashMode,     setFlashMode]     = useState<'off' | 'on'>('off');
  const [zoom,          setZoom]          = useState<number>(ZOOM_LEVELS[DEFAULT_ZOOM_IDX].value);
  const [autofocusMode, setAutofocusMode] = useState<'on' | 'off'>('off');
  const [activeZoomIdx, setActiveZoomIdx] = useState(DEFAULT_ZOOM_IDX);

  // ── Thumbnail derived ──────────────────────────────────────────────────────
  const capturedCount = photos.length;
  const lastPhoto     = capturedCount > 0 ? photos[capturedCount - 1] : null;
  const lastPhotoUri  = lastPhoto?.bgRemovedUri ?? lastPhoto?.rawUri ?? null;
  const anyProcessing = photos.some((p) => p.isProcessing);
  const lastError     = photos.findLast?.((p) => p.bgError)?.bgError ?? null;

  // ── Navigate to photo-confirm after each capture ───────────────────────────
  // Handled inside handleCapture immediately after addCapture() so the user
  // reviews each photo before coming back for the next step.

  // ── Focus frame animation (fade + scale in on permission grant) ─────────────
  const frameOpacity    = useSharedValue(0);
  const frameScale      = useSharedValue(1.06);
  const focusTranslateX = useSharedValue(0);
  const focusTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!permission?.granted) return;
    const t = setTimeout(() => {
      frameOpacity.value = withTiming(1, { duration: 400 });
      frameScale.value   = withSpring(1, { damping: 18, stiffness: 200 });
    }, 600);
    return () => clearTimeout(t);
  }, [permission?.granted]); // eslint-disable-line

  const frameStyle = useAnimatedStyle(() => ({
    opacity:   frameOpacity.value,
    transform: [
      { translateX: focusTranslateX.value },
      { translateY: focusTranslateY.value },
      { scale: frameScale.value },
    ],
  }));

  // ── Hint animation (show briefly after each step change) ──────────────────
  const hintOpacity = useSharedValue(0);
  const hintTimer        = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(hintTimer.current);
    hintOpacity.value = withTiming(0, { duration: 80 });
    hintTimer.current = setTimeout(() => {
      hintOpacity.value = withSequence(
        withTiming(1, { duration: 350 }),
        withTiming(1, { duration: 5000 }),
        withTiming(0, { duration: 350 }),
      );
    }, 2200);
    return () => clearTimeout(hintTimer.current);
  }, [stepIndex]); // eslint-disable-line

  const hintStyle = useAnimatedStyle(() => ({ opacity: hintOpacity.value }));

  // ── Focus timeout cleanup ───────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(focusDebounceRef.current);
  }, []);

  // ── Pinch-to-zoom ──────────────────────────────────────────────────────────
  const zoomRef           = useRef<number>(ZOOM_LEVELS[DEFAULT_ZOOM_IDX].value);
  const prevDistRef       = useRef(0);
  const lastZoomUpdateRef = useRef(0);

  // ── Zoom carousel row shift ────────────────────────────────────────────────
  // Shift the row so the tapped button always lands at center.
  // Each slot = button(30px) + gap(12px) = 42px Figma → sx(42) device px.
  // 3 buttons: center index = 1. Offset = (1 - index) * sx(42).
  // index 0 → +42px (shift right), index 1 → 0 (stay), index 2 → -42px (shift left)
  const zoomRowX   = useSharedValue((1 - DEFAULT_ZOOM_IDX) * 42); // rough init; corrected after layout
  useEffect(() => {
    zoomRowX.value = (1 - DEFAULT_ZOOM_IDX) * sx(42);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const zoomRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: zoomRowX.value }],
  }));

  // ── Zoom button selection ──────────────────────────────────────────────────
  const handleZoomSelect = useCallback((index: number) => {
    setActiveZoomIdx(index);
    const value = ZOOM_LEVELS[index].value;
    zoomRef.current = value;
    setZoom(value);
    // Spring-slide row so tapped button is centered (3-button formula: 1 - index)
    zoomRowX.value = withTiming((1 - index) * sx(42), { duration: 220, easing: Easing.inOut(Easing.ease) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sx]);

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
            ts[1].pageX - ts[0].pageX,
            ts[1].pageY - ts[0].pageY,
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
          // Throttle state updates to ~80 ms — prevents per-frame re-renders
          const now = Date.now();
          if (now - lastZoomUpdateRef.current >= 80) {
            setZoom(newZoom);
            lastZoomUpdateRef.current = now;
          }
        }
        prevDistRef.current = dist;
      },
      onPanResponderRelease:   () => { prevDistRef.current = 0; setZoom(zoomRef.current); },
      onPanResponderTerminate: () => { prevDistRef.current = 0; setZoom(zoomRef.current); },
    })
  ).current;

  // ── Capture ────────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || allCaptured) return;
    setCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      const uri = result?.uri ?? '';
      if (!uri) return;

      const photoId = addCapture(uri);

      // Navigate immediately — user reviews & confirms before next shot
      router.push('/(onboarding)/photo-confirm');

      removeBackground(uri)
        .then((bgUri) => {
          setBgRemoved(photoId, bgUri);
          setBgError(photoId, null);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[camera-scan] removeBackground failed:', msg);
          setBgRemoved(photoId, null);
          setBgError(photoId, msg);
        })
        .finally(() => setProcessing(photoId, false));
    } finally {
      setCapturing(false);
    }
  }, [capturing, allCaptured, addCapture, setBgRemoved, setBgError, setProcessing]);

  // ── Upload from library — Figma 675:1041: routes through the same
  // capture → bg-removal → photo-confirm flow as the shutter.
  const handlePickFromLibrary = useCallback(async () => {
    if (capturing || allCaptured) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.85,
    });
    const uri = result.assets?.[0]?.uri;
    if (result.canceled || !uri) return;

    const photoId = addCapture(uri);
    router.push('/(onboarding)/photo-confirm');

    removeBackground(uri)
      .then((bgUri) => {
        setBgRemoved(photoId, bgUri);
        setBgError(photoId, null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[camera-scan] removeBackground failed:', msg);
        setBgRemoved(photoId, null);
        setBgError(photoId, msg);
      })
      .finally(() => setProcessing(photoId, false));
  }, [capturing, allCaptured, addCapture, setBgRemoved, setBgError, setProcessing]);

  // ── Tap-to-focus ────────────────────────────────────────────────────────────
  const handleCameraTap = useCallback((locationX: number, locationY: number) => {
    if (capturing || allCaptured) return;

    clearTimeout(focusDebounceRef.current);

    // Default bracket centre in card-relative coords
    const defCX = sx(FOCUS_L + FOCUS_W / 2);
    const defCY = sy(FOCUS_T + FOCUS_H / 2);

    // Clamp so brackets don't overshoot card edges
    const halfW  = sx(FOCUS_W) / 2;
    const halfH  = sy(FOCUS_H) / 2;
    const clampX = Math.max(halfW, Math.min(sx(CARD_W) - halfW, locationX));
    const clampY = Math.max(halfH, Math.min(sy(CARD_H) - halfH, locationY));

    // Move brackets to tap position and pulse — stay there until next tap
    focusTranslateX.value = withTiming(clampX - defCX, { duration: 160 });
    focusTranslateY.value = withTiming(clampY - defCY, { duration: 160 });
    frameScale.value = withSequence(
      withTiming(0.88, { duration: 120 }),
      withTiming(1.0,  { duration: 160 }),
    );

    // iOS: flip autofocus 'off'→'on' (trigger one focus cycle) → back to 'off'
    setAutofocusMode('on');
    focusDebounceRef.current = setTimeout(() => setAutofocusMode('off'), 500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing, allCaptured, sx, sy]);

  // ── Current step ───────────────────────────────────────────────────────────
  const safeStep    = Math.min(stepIndex, SCAN_STEPS.length - 1);
  const currentStep = SCAN_STEPS[safeStep];

  // ─── Permission request ────────────────────────────────────────────────────
  if (!permission) return <View style={s.root} />;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1 }}>
        <SkyBackground>
          <View style={[s.permWrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
            <View style={s.permCard}>
              <Text style={s.permTitle}>Your camera, your closet</Text>
              <Text style={s.permBody}>
                whether uses your camera to photograph your clothes and build a digital closet.
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

  // ── Derived layout values ──────────────────────────────────────────────────
  // Root has paddingTop: insets.top, so all sy() values are below the notch.
  const cardTop    = sy(CARD_TOP);
  const cardLeft   = sx(CARD_LEFT);
  const cardWidth  = sx(CARD_W);
  const cardHeight = sy(CARD_H);

  // Focus rect inside camera card (card-relative)
  const focusL = sx(FOCUS_L);
  const focusT = sy(FOCUS_T);
  const focusW = sx(FOCUS_W);
  const focusH = sy(FOCUS_H);

  // Hint pill inside camera card (card-relative)
  const hintLeft  = sx(HINT_L);
  const hintTop   = sy(HINT_TOP);
  const hintWidth = sx(HINT_W);

  // Bottom controls (below camera card)
  const shutterTop = sy(SHUTTER_TOP);
  const flashTop   = sy(FLASH_TOP);
  const thumbTop   = sy(THUMB_TOP);

  // ─── Main screen ──────────────────────────────────────────────────────────
  return (
    // paddingTop: insets.top shifts all content below the notch/dynamic island
    <View style={[s.root, { paddingTop: insets.top }]} {...pinchResponder.panHandlers}>

      {/* ── BACK link — Figma 675:418: left:20, top:85, chevron + "back" ── */}
      <Pressable
        style={[s.backBtn, { top: sy(85), left: 20 }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={14} color={Colors.surface[100]} />
        <Text style={s.backText}>BACK</Text>
      </Pressable>

      {/* ── Flash toggle — Figma 675:1047: top:85, right:20 ─────────────── */}
      <Pressable
        style={[s.flashBtn, { top: sy(85), right: 20 }]}
        onPress={() => setFlashMode((m) => (m === 'off' ? 'on' : 'off'))}
        hitSlop={14}
        accessibilityLabel={flashMode === 'off' ? 'Turn flash on' : 'Turn flash off'}
      >
        <Ionicons
          name={flashMode === 'on' ? 'flash' : 'flash-off'}
          size={22}
          color={flashMode === 'on' ? '#f5d050' : 'rgba(245,244,244,0.55)'}
        />
      </Pressable>

      {/* ── Camera card — rounded, contained viewfinder */}
      {/* Figma: left:20, top:124, w:353, h:601, r:16 */}
      <View
        style={[
          s.cameraCard,
          { left: cardLeft, top: cardTop, width: cardWidth, height: cardHeight },
        ]}
      >
        {/* Live camera feed — fills card */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus={autofocusMode}
          zoom={zoom}
          flash={flashMode}
        />

        {/* Focus brackets (card-relative coords) */}
        {!allCaptured && (
          <Animated.View
            style={[
              s.focusFrame,
              { left: focusL, top: focusT, width: focusW, height: focusH },
              frameStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[s.brk, s.bTL]} />
            <View style={[s.brk, s.bTR]} />
            <View style={[s.brk, s.bBL]} />
            <View style={[s.brk, s.bBR]} />
          </Animated.View>
        )}

        {/* Hint pill — overlaid on camera card near bottom */}
        {/* Figma: left:51-20=31 (card-relative), top:651-124=527, w:292 */}
        <Animated.View
          style={[
            s.hintPill,
            { left: hintLeft, top: hintTop, width: hintWidth },
            hintStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={s.hintText}>
            ENSURE ITEM IS LAYING FLAT ON A SOLID BACKGROUND AND CENTRED
          </Text>
        </Animated.View>

        {/* Tap-to-focus overlay — transparent full-card Pressable above CameraView */}
        {/* Single-finger taps reach here; 2-finger pinches are captured by root PanResponder first */}
        {!allCaptured && (
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
            onPress={(e) => handleCameraTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          />
        )}

        {/* ── Zoom picker — Figma 524:181 */}
        {/* Screen top: 680px → card-relative top: 680-124=556 → bottom: 601-556=45 */}
        {/* Carousel: row translates so active button is always centered (spring) */}
        {!allCaptured && (
          <View
            style={{
              position:       'absolute',
              left:           0,
              right:          0,
              bottom:         sy(45),
              alignItems:     'center',
              zIndex:         25,
            }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[{ flexDirection: 'row', gap: sx(12) }, zoomRowStyle]}
              pointerEvents="box-none"
            >
              {ZOOM_LEVELS.map((level, i) => (
                <ZoomButton
                  key={level.label}
                  label={level.label}
                  activeLabel={level.activeLabel}
                  isActive={i === activeZoomIdx}
                  onPress={() => handleZoomSelect(i)}
                />
              ))}
            </Animated.View>
          </View>
        )}
      </View>

      {/* ════════ CONTROLS BELOW CARD (on dark bg) ════════ */}

      {/* ── Upload from library — Figma 675:1041: bottom-left ─────────── */}
      <Pressable
        style={[s.uploadBtn, { left: sx(FLASH_L), top: flashTop }]}
        onPress={handlePickFromLibrary}
        hitSlop={14}
        disabled={capturing || allCaptured}
        accessibilityLabel="Upload a photo from your library"
      >
        <Ionicons name="push-outline" size={24} color="rgba(245,244,244,0.85)" />
      </Pressable>

      {/* ── Shutter — Figma: centred H, top:752, outer:72 inner:57 */}
      <Pressable
        style={[
          s.shutterOuter,
          {
            top:  shutterTop,
            left: (sw - SHUTTER_OUTER) / 2,
            width:  SHUTTER_OUTER,
            height: SHUTTER_OUTER,
            borderRadius: SHUTTER_OUTER / 2,
          },
        ]}
        onPress={handleCapture}
        disabled={capturing || allCaptured}
        hitSlop={6}
        accessibilityLabel={
          allCaptured ? 'All photos taken' : `Take photo — ${currentStep.label}`
        }
      >
        <View
          style={[
            s.shutterInner,
            {
              width:  SHUTTER_INNER,
              height: SHUTTER_INNER,
              borderRadius: SHUTTER_INNER / 2,
            },
            (capturing || allCaptured) && s.shutterDisabled,
          ]}
        />
      </Pressable>

      {/* ── Photo confirmation thumbnail — Figma: left:318, top:765 */}
      {/* Stacked squares: back (#737373 rotated 14.67°) + front (photo) */}
      <Pressable
        style={[s.thumbHitArea, { left: sx(THUMB_L), top: thumbTop }]}
        disabled={capturedCount === 0}
        onPress={() => router.push('/(onboarding)/photo-confirm')}
        accessibilityLabel={capturedCount > 0 ? 'Review your photos' : undefined}
      >
        <View style={s.thumbWrap}>
          {/* Back square — Figma 144:102: #737373, rotated 14.67deg */}
          <View style={s.thumbBack} />

          {/* Front square — Figma 144:103: shows last photo or placeholder */}
          {lastPhotoUri ? (
            <Image source={{ uri: lastPhotoUri }} style={s.thumbFront} />
          ) : (
            <View style={[s.thumbFront, s.thumbPlaceholder]} />
          )}

          {/* Spinner while BG removal in flight */}
          {anyProcessing && capturedCount > 0 && (
            <View style={s.thumbOverlay}>
              <ActivityIndicator size="small" color={Colors.surface[100]} />
            </View>
          )}

          {/* Error indicator */}
          {!anyProcessing && lastError && (
            <View style={s.thumbErrorBadge}>
              <Ionicons name="warning" size={10} color={Colors.danger[100]} />
            </View>
          )}

          {/* Count badge — Figma 478:24: surface-200 circle, top-left, 16px */}
          {capturedCount > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{capturedCount}</Text>
            </View>
          )}

          {/* Check badge — Figma 478:25: surface-200 circle, bottom-right */}
          {capturedCount > 0 && !anyProcessing && !lastError && (
            <View style={s.checkBadge}>
              <Ionicons name="checkmark" size={8} color={Colors.surface[100]} />
            </View>
          )}
        </View>
      </Pressable>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Root — Figma background: surface-200 (#2b1e1e), dark warm brown
  root: { flex: 1, backgroundColor: Colors.surface[200] },

  // ── BACK link — Figma 675:418: chevron + "back", surface-100 14px
  backBtn: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
    zIndex:        10,
  },
  backText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[100],
  },

  // ── Upload-from-library button — Figma 675:1041: bottom-left
  uploadBtn: {
    position:       'absolute',
    width:          37,
    height:         37,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         10,
  },

  // ── Camera card — rounded, contained viewfinder (Figma: r:16)
  cameraCard: {
    position:        'absolute',
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: '#111',  // shows while camera loads
  },

  // ── Focus bracket frame (inside camera card)
  focusFrame: { position: 'absolute', zIndex: 6 },
  brk: {
    position: 'absolute',
    width:    BRACKET_ARM,
    height:   BRACKET_ARM,
  },
  bTL: {
    top: 0, left: 0,
    borderTopWidth:  BRACKET_THICK,
    borderLeftWidth: BRACKET_THICK,
    borderColor:     BRACKET_COLOR,
  },
  bTR: {
    top: 0, right: 0,
    borderTopWidth:   BRACKET_THICK,
    borderRightWidth: BRACKET_THICK,
    borderColor:      BRACKET_COLOR,
  },
  bBL: {
    bottom: 0, left: 0,
    borderBottomWidth: BRACKET_THICK,
    borderLeftWidth:   BRACKET_THICK,
    borderColor:       BRACKET_COLOR,
  },
  bBR: {
    bottom: 0, right: 0,
    borderBottomWidth: BRACKET_THICK,
    borderRightWidth:  BRACKET_THICK,
    borderColor:       BRACKET_COLOR,
  },

  // ── Hint pill — Figma node 675:411 (semi-transparent scrim over camera feed)
  
  // bg = dark semi-transparent scrim, text = surface-100 (light).
  // Figma: px:44, py:8, r:24. Caption-2: DM Mono 10px uppercase.
  hintPill: {
    position:          'absolute',
    backgroundColor:   'rgba(43,30,30,0.58)',    // dark scrim over camera feed
    borderRadius:      24,
    paddingHorizontal: 44,                        // Figma: px-[44px]
    paddingVertical:   8,
    alignItems:        'center',
    justifyContent:    'center',
    zIndex:            10,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       'rgba(245,244,244,0.12)',  // subtle rim
  },
  hintText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    textAlign:     'center',
    color:         Colors.surface[100],           // #f5f4f4 — light on dark scrim
  },

  // ── Flash toggle button
  flashBtn: {
    position:       'absolute',
    width:          37,
    height:         37,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         10,
  },

  // ── Shutter button
  shutterOuter: {
    position:        'absolute',
    borderWidth:     3,
    borderColor:     'rgba(255,255,255,0.70)',
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: 'transparent',
    zIndex:          10,
  },
  shutterInner: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  shutterDisabled: { opacity: 0.30 },

  // ── Thumbnail hit area + stack
  thumbHitArea: {
    position: 'absolute',
    zIndex:   10,
    padding:  4,  // extra tap target
  },
  thumbWrap: {
    width:    THUMB_SIZE + 10,
    height:   THUMB_SIZE + 14,
    position: 'relative',
  },
  // Back square: #737373, rotated 14.67°, slightly offset
  thumbBack: {
    position:        'absolute',
    top:             6,
    left:            4,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    backgroundColor: '#737373',
    borderRadius:    3,
    transform:       [{ rotate: '14.67deg' }],
  },
  // Front square: photo or placeholder
  thumbFront: {
    position:     'absolute',
    top:          6,
    left:         0,
    width:        THUMB_SIZE,
    height:       THUMB_SIZE,
    borderRadius: 3,
    overflow:     'hidden',
  },
  thumbPlaceholder: {
    backgroundColor: Colors.surface[30],
  },
  // Processing overlay
  thumbOverlay: {
    position:        'absolute',
    top:             6,
    left:            0,
    width:           THUMB_SIZE,
    height:          THUMB_SIZE,
    borderRadius:    3,
    backgroundColor: 'rgba(43,30,30,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          3,
  },
  // Error badge (top-right, warning icon)
  thumbErrorBadge: {
    position:        'absolute',
    top:             0,
    right:           -2,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.surface[100],
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          5,
  },
  // Count badge — Figma 478:24: surface-200, top-left, 16px circle
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
  countText: {
    fontFamily:    FontFamily.sans,
    fontSize:      7.68,
    lineHeight:    10,
    letterSpacing: -0.12,
    color:         '#d9d9d9',
    textTransform: 'uppercase',
  },
  // Check badge — Figma 478:25: surface-200, bottom-right, 14px circle
  checkBadge: {
    position:        'absolute',
    bottom:          0,
    right:           -4,
    width:           14,
    height:          14,
    borderRadius:    7,
    backgroundColor: Colors.surface[200],
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          4,
  },

  // ── Permission screen (SkyBackground card) ─────────────────────────────────
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
