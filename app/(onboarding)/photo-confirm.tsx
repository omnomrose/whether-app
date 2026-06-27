// Figma node 424:176 — "onboard | recent photos pop up"
//
// Annotations:
//   • Header "⌄ RECENT PHOTOS": on click/swipe-down → back to camera
//   • Carousel: swipe left ↔ right; active item is VISIBLY LARGER than neighbours
//               (smooth scale + opacity animation driven by scroll position)
//   • "IS THIS GOOD?" prompt beneath active photo
//   • RETAKE PHOTO → remove from session, rewind step, back to camera
//   • YES, ADD TO CLOSET → clothing-detail tagging screen
//   • Swipe-down anywhere → back to camera
//
// Carousel dimensions (Figma 393×852):
//   Active photo:  left:8, top:204, w:390, h:367 (nearly full-width)
//   Adjacent peek: ~24 px visible on each side, scale 0.92, opacity 0.6

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// FlatList must be wrapped so native onScroll events work with useNativeDriver
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<ScanPhoto>);
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useScanStore, type ScanPhoto } from '@/store/scanStore';
import { useClosetStore } from '@/store/closetStore';

// ─── Figma frame reference (393 × 852) ────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Carousel item component ───────────────────────────────────────────────────
// Kept as a separate component so it can compute animated style via useMemo.
type CarouselItemProps = {
  item:         ScanPhoto;
  index:        number;
  scrollX:      Animated.Value;
  itemW:        number;
  itemSpacing:  number;
  snapInterval: number;
  photoH:       number;
};

function CarouselItem({
  item,
  index,
  scrollX,
  itemW,
  itemSpacing,
  snapInterval,
  photoH,
}: CarouselItemProps) {
  // Scale: 1.0 at active position, 0.92 at ±1 position
  const scale = useMemo(
    () =>
      scrollX.interpolate({
        inputRange:  [
          (index - 1) * snapInterval,
          index       * snapInterval,
          (index + 1) * snapInterval,
        ],
        outputRange: [0.92, 1, 0.92],
        extrapolate: 'clamp',
      }),
    [scrollX, index, snapInterval],
  );

  // Opacity: 1.0 active, 0.55 adjacent
  const opacity = useMemo(
    () =>
      scrollX.interpolate({
        inputRange:  [
          (index - 1) * snapInterval,
          index       * snapInterval,
          (index + 1) * snapInterval,
        ],
        outputRange: [0.55, 1, 0.55],
        extrapolate: 'clamp',
      }),
    [scrollX, index, snapInterval],
  );

  const uri     = item.bgRemovedUri ?? item.rawUri;
  const loading = item.isProcessing;

  return (
    <Animated.View
      style={[
        ci.wrap,
        {
          width:       itemW,
          height:      photoH,
          marginRight: itemSpacing,
          transform:   [{ scale }],
          opacity,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, ci.placeholder]} />
      )}

      {/* Processing overlay */}
      {loading && (
        <View style={ci.overlay}>
          <ActivityIndicator size="small" color={Colors.surface[150]} />
          <Text style={ci.overlayText}>REMOVING BACKGROUND…</Text>
        </View>
      )}

      {/* BG-removal error */}
      {!loading && item.bgError && (
        <View style={[ci.overlay, ci.errorOverlay]}>
          <Ionicons name="warning-outline" size={20} color={Colors.danger[100]} />
          <Text style={[ci.overlayText, ci.errorText]}>BG REMOVAL FAILED</Text>
        </View>
      )}

      {/* Confirmed badge — top-right checkmark */}
      {item.addedToCloset && !loading && (
        <View style={ci.confirmedBadge} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={22} color={Colors.surface[200]} />
        </View>
      )}
    </Animated.View>
  );
}

const ci = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: Colors.surface[20],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,244,244,0.82)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
  },
  errorOverlay: {
    backgroundColor: 'rgba(254,226,226,0.92)',
  },
  overlayText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  errorText: {
    color: Colors.danger[200],
  },
  confirmedBadge: {
    position:        'absolute',
    top:             12,
    right:           12,
    backgroundColor: 'rgba(245,244,244,0.88)',
    borderRadius:    50,
    padding:         4,
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function PhotoConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

  const sx = (x: number) => (x / FW) * sw;
  const sy = (y: number) => (y / FH) * sh;

  // ── Stores ──────────────────────────────────────────────────────────────────
  const { photos, completed, retakePhoto } = useScanStore();
  const { removeItem } = useClosetStore();

  // Navigate to main app when all photos confirmed
  useEffect(() => {
    if (completed) router.replace('/(tabs)');
  }, [completed]);

  // ── Carousel constants (derived from screen width) ─────────────────────────
  // ITEM_W leaves ~30 px on each side for peek: LIST_PADDING - ITEM_SPACING = 22 px visible
  const ITEM_W        = sw - sx(60);
  const ITEM_SPACING  = sx(8);
  const SNAP_INTERVAL = ITEM_W + ITEM_SPACING;
  const LIST_PADDING  = (sw - ITEM_W) / 2;   // = sx(30), centers active item
  const PHOTO_H       = sy(367);

  // ── Carousel state ──────────────────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, photos.length - 1),
  );
  const listRef   = useRef<any>(null);
  const scrollX   = useRef(new Animated.Value(0)).current;
  const didScroll = useRef(false);

  // On first open, jump to most-recent photo (no animation — instant)
  useEffect(() => {
    if (didScroll.current || photos.length === 0) return;
    didScroll.current = true;
    const last = photos.length - 1;
    setActiveIndex(last);
    if (last > 0) {
      setTimeout(
        () =>
          listRef.current?.scrollToOffset({
            offset:   last * SNAP_INTERVAL,
            animated: false,
          }),
        60,
      );
      // Pre-warm scrollX so scale is correct before the FlatList scrolls
      scrollX.setValue(last * SNAP_INTERVAL);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  // Track active index when scroll settles
  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
      setActiveIndex(Math.max(0, Math.min(photos.length - 1, idx)));
    },
    [SNAP_INTERVAL, photos.length],
  );

  // ── Swipe-down to dismiss ──────────────────────────────────────────────────
  const swipeDown = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 12 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.6,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 60) router.back();
      },
    }),
  ).current;

  // ── Active photo + derived state ───────────────────────────────────────────
  const activePhoto = photos[activeIndex] ?? photos[photos.length - 1];
  const isConfirmed = activePhoto?.addedToCloset ?? false;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    if (!activePhoto) return;
    if (activePhoto.addedToCloset) removeItem(activePhoto.id);
    retakePhoto(activePhoto.id);
    router.back();
  }, [activePhoto, removeItem, retakePhoto]);

  const handleAddToCloset = useCallback(() => {
    if (!activePhoto || activePhoto.addedToCloset) return;
    router.push(`/(onboarding)/clothing-detail?photoId=${activePhoto.id}`);
  }, [activePhoto]);

  // ── renderItem ──────────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: ScanPhoto; index: number }) => (
      <CarouselItem
        item={item}
        index={index}
        scrollX={scrollX}
        itemW={ITEM_W}
        itemSpacing={ITEM_SPACING}
        snapInterval={SNAP_INTERVAL}
        photoH={PHOTO_H}
      />
    ),
    // scrollX is a stable ref; ITEM_W/SNAP_INTERVAL/PHOTO_H change only on
    // screen resize which is not expected in this portrait-locked app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrollX, ITEM_W, ITEM_SPACING, SNAP_INTERVAL, PHOTO_H],
  );

  // ── Layout values ───────────────────────────────────────────────────────────
  const headerTop   = sy(77) + insets.top;
  const carouselTop = sy(204);
  const questionTop = sy(561);
  const btnTop      = sy(670);

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <View style={[s.root, s.emptyRoot]}>
        <Text style={s.emptyText}>NO PHOTOS YET</Text>
        <Pressable style={s.emptyBtn} onPress={() => router.back()}>
          <Text style={s.emptyBtnText}>BACK TO CAMERA</Text>
        </Pressable>
      </View>
    );
  }

  // ── Main ────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root} {...swipeDown.panHandlers}>

      {/* ── Header: ⌄ RECENT PHOTOS ─────────────────────────────────────────── */}
      {/* Annotation: on click/swipe down → back to camera */}
      <Pressable
        style={[s.header, { top: headerTop, left: sx(22) }]}
        onPress={() => router.back()}
        accessibilityLabel="Back to camera"
      >
        <Ionicons name="chevron-down" size={16} color={Colors.surface[200]} />
        <Text style={s.headerText}>RECENT PHOTOS</Text>
      </Pressable>

      {/* ── Scale carousel ──────────────────────────────────────────────────── */}
      {/* Annotation: active item visibly larger; smooth anim as user swipes */}
      <View style={[s.carouselWrap, { top: carouselTop, height: PHOTO_H }]}>
        <AnimatedFlatList
          ref={listRef as any}
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item: ScanPhoto) => item.id}
          renderItem={renderItem as any}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: LIST_PADDING }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          bounces={false}
          onScrollToIndexFailed={() => {}}
        />
      </View>

      {/* ── Page dots ───────────────────────────────────────────────────────── */}
      {photos.length > 1 && (
        <View style={[s.dots, { top: carouselTop + PHOTO_H + sx(10) }]}>
          {photos.map((p, i) => (
            <View
              key={p.id}
              style={[
                s.dot,
                i === activeIndex  && s.dotActive,
                p.addedToCloset    && s.dotDone,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── "IS THIS GOOD?" (Figma 431:28: top:561, centred, 16/20 px) ──────── */}
      {!isConfirmed && (
        <Text style={[s.question, { top: questionTop }]}>IS THIS GOOD?</Text>
      )}

      {/* ── Action buttons (Figma 450:34 / 450:35: top:670) ─────────────────── */}
      {/* RETAKE: left:21, w:168  |  YES ADD: left:50%+6.5, w:170 */}
      <View style={[s.btnRow, { top: btnTop }]}>

        <Pressable
          style={[s.btn, { left: sx(21), width: sx(168) }]}
          onPress={handleRetake}
          accessibilityLabel="Retake photo"
        >
          <Text style={s.btnText}>RETAKE PHOTO</Text>
        </Pressable>

        {isConfirmed ? (
          <View
            style={[
              s.btn,
              s.btnAdded,
              { left: sw / 2 + sx(6.5), width: sx(170) },
            ]}
          >
            <Ionicons name="checkmark" size={12} color={Colors.surface[150]} />
            <Text style={[s.btnText, s.btnTextMuted]}>ADDED</Text>
          </View>
        ) : (
          <Pressable
            style={[
              s.btn,
              { left: sw / 2 + sx(6.5), width: sx(170) },
              activePhoto?.isProcessing && s.btnDisabled,
            ]}
            onPress={handleAddToCloset}
            disabled={activePhoto?.isProcessing}
            accessibilityLabel="Add to closet"
          >
            <Text
              style={[
                s.btnText,
                activePhoto?.isProcessing && s.btnTextMuted,
              ]}
            >
              YES, ADD TO CLOSET
            </Text>
          </Pressable>
        )}

      </View>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.surface[100],
  },
  emptyRoot: {
    justifyContent: 'center',
    alignItems:     'center',
  },

  // ── Header (Figma 453:34) ───────────────────────────────────────────────────
  header: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    zIndex:        20,
  },
  headerText: {
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // ── Carousel container ──────────────────────────────────────────────────────
  carouselWrap: {
    position: 'absolute',
    left:     0,
    right:    0,
  },

  // ── Page dots ───────────────────────────────────────────────────────────────
  dots: {
    position:       'absolute',
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
    zIndex:         10,
  },
  dot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: 'rgba(43,30,30,0.22)',
  },
  dotActive: { backgroundColor: Colors.surface[200] },
  dotDone:   { backgroundColor: Colors.surface[30] },

  // ── "IS THIS GOOD?" (Figma 431:28) ─────────────────────────────────────────
  question: {
    position:      'absolute',
    left:          0,
    right:         0,
    textAlign:     'center',
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    zIndex:        10,
  },

  // ── Action buttons (Figma 450:34 / 450:35) ──────────────────────────────────
  btnRow: {
    position: 'absolute',
    left:     0,
    right:    0,
    zIndex:   10,
  },
  btn: {
    position:        'absolute',
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    paddingVertical: 10,
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       44,
    flexDirection:   'row',
    gap:             4,
  },
  btnAdded:    { borderColor: Colors.surface[20] },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  btnTextMuted: { color: Colors.surface[150] },

  // ── Empty state ─────────────────────────────────────────────────────────────
  emptyText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
    marginBottom:  24,
  },
  emptyBtn: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
  },
  emptyBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
});
