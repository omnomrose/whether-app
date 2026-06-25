// Figma node 424:176 — "onboard | recent photos"
//
// Opens when the user taps the thumbnail button in camera-scan (or auto-
// navigates after all 6 shots are taken).
//
// Layout: header → full-width swipeable carousel → "IS THIS GOOD?" → buttons
//
// Each page = one ScanPhoto from the store.
// The displayed image is bgRemovedUri (data:image/png;base64,…) while available,
// falling back to rawUri while PhotoRoom is still processing.
//
// Buttons act on the currently-visible photo:
//   Unconfirmed → RETAKE PHOTO | YES, ADD TO CLOSET
//   Confirmed   → RETAKE PHOTO | ADDED (greyed)
//
// Retake: removes photo from store + rewinds stepIndex → back to camera.
// Add:    adds to closetStore + marks confirmToCloset → button becomes ADDED.
// When every photo is confirmed → completed becomes true → navigate to main app.
// Swipe-down or header tap → back to camera.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ComponentRef,
} from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  PanResponder,
  type ViewToken,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useScanStore, type ScanPhoto } from '@/store/scanStore';
import { useClosetStore } from '@/store/closetStore';

// ─── Figma frame reference (393 × 852) ────────────────────────────────────────
const FH = 852;

export default function PhotoConfirmScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();
  const sy = (y: number) => Math.round((y / FH) * sh);

  // ── Store ──────────────────────────────────────────────────────────────────
  const {
    photos,
    completed,
    confirmToCloset,
    retakePhoto,
  } = useScanStore();

  const { addItem, removeItem } = useClosetStore();

  // ── Navigate to main app when all photos are confirmed ─────────────────────
  useEffect(() => {
    if (completed) {
      router.replace('/(tabs)');
    }
  }, [completed]);

  // ── Carousel state ─────────────────────────────────────────────────────────
  const flatListRef   = useRef<ComponentRef<typeof FlatList<ScanPhoto>>>(null);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, photos.length - 1));

  // Scroll to the last photo when screen opens
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || photos.length === 0) return;
    scrolledRef.current = true;
    const lastIdx = photos.length - 1;
    if (lastIdx > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: lastIdx, animated: false });
      }, 60);
    }
    setActiveIndex(lastIdx);
  }, [photos.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  // ── Swipe-down to go back ──────────────────────────────────────────────────
  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 10 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 70) router.back();
      },
    })
  ).current;

  // ── Active photo ───────────────────────────────────────────────────────────
  const activePhoto    = photos[activeIndex] ?? photos[photos.length - 1];
  const isConfirmed    = activePhoto?.addedToCloset ?? false;
  const isProcessing   = activePhoto?.isProcessing ?? false;

  // ── Button handlers ────────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    if (!activePhoto) return;
    // Remove from closet if already added
    if (activePhoto.addedToCloset) {
      removeItem(activePhoto.id);
    }
    retakePhoto(activePhoto.id);
    router.back();   // return to camera so user can reshoot
  }, [activePhoto, removeItem, retakePhoto]);

  const handleAddToCloset = useCallback(() => {
    if (!activePhoto || activePhoto.addedToCloset) return;
    const imageUrl = activePhoto.bgRemovedUri ?? activePhoto.rawUri;
    addItem({
      id:        activePhoto.id,
      imageUrl,
      category:  activePhoto.category,
      tags:      [],
      createdAt: new Date().toISOString(),
    });
    confirmToCloset(activePhoto.id);
    // If there's a next unconfirmed photo, scroll to it
    const nextUnconfirmed = photos.findIndex(
      (p, i) => i > activeIndex && !p.addedToCloset,
    );
    if (nextUnconfirmed !== -1) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: nextUnconfirmed, animated: true });
      }, 120);
    }
  }, [activePhoto, activeIndex, photos, addItem, confirmToCloset]);

  // ── Layout anchors ─────────────────────────────────────────────────────────
  const headerTop   = sy(85) + insets.top;
  const heroTop     = sy(204);
  const heroH       = sy(367);
  const questionTop = sy(561);
  const btnTop      = sy(670);

  // ── Carousel render item ───────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ScanPhoto>) => {
      const uri      = item.bgRemovedUri ?? item.rawUri;
      const loading  = item.isProcessing;

      return (
        <View style={[s.carouselPage, { width: sw }]}>
          <View style={[s.heroWrap, { height: heroH, width: sw - 16 }]}>
            {uri ? (
              <Image
                source={{ uri }}
                style={s.heroImage}
                resizeMode="contain"
              />
            ) : (
              <View style={s.heroPlaceholder} />
            )}

            {loading && (
              <View style={s.heroOverlay}>
                <ActivityIndicator size="small" color={Colors.surface[150]} />
                <Text style={s.removingText}>REMOVING BACKGROUND…</Text>
              </View>
            )}

            {/* API error — show message so we can debug */}
            {!loading && item.bgError && (
              <View style={[s.heroOverlay, s.errorOverlay]}>
                <Ionicons name="warning-outline" size={20} color={Colors.danger[100]} />
                <Text style={s.errorText}>BG REMOVAL FAILED</Text>
                <Text style={s.errorDetail} numberOfLines={3}>{item.bgError}</Text>
              </View>
            )}

            {item.addedToCloset && (
              <View style={s.confirmedBadge} pointerEvents="none">
                <Ionicons name="checkmark-circle" size={22} color={Colors.surface[200]} />
              </View>
            )}
          </View>
        </View>
      );
    },
    [sw, heroH]
  );

  // ── Empty state ────────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.emptyText}>NO PHOTOS YET</Text>
        <Pressable onPress={() => router.back()} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>BACK TO CAMERA</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.root} {...swipeResponder.panHandlers}>

      {/* ── Header: < RECENT PHOTOS ─────────────────────────────────────── */}
      <Pressable
        style={[s.header, { top: headerTop }]}
        onPress={() => router.back()}
        accessibilityLabel="Back to camera"
      >
        <Ionicons name="chevron-back" size={20} color={Colors.surface[200]} />
        <Text style={s.headerText}>RECENT PHOTOS</Text>
      </Pressable>

      {/* ── Carousel ────────────────────────────────────────────────────── */}
      <FlatList<ScanPhoto>
        ref={flatListRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={() => {}}
        style={[s.carousel, { top: heroTop, height: heroH }]}
        bounces={false}
        decelerationRate="fast"
      />

      {/* ── Page dots ─────────────────────────────────────────────────────── */}
      {photos.length > 1 && (
        <View style={[s.pageDots, { top: heroTop + heroH + 12 }]}>
          {photos.map((p, i) => (
            <View
              key={p.id}
              style={[
                s.pageDot,
                i === activeIndex && s.pageDotActive,
                p.addedToCloset && s.pageDotConfirmed,
              ]}
            />
          ))}
        </View>
      )}

      {/* ── "IS THIS GOOD?" ─────────────────────────────────────────────── */}
      {!isConfirmed && (
        <Text style={[s.question, { top: questionTop }]}>IS THIS GOOD?</Text>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <View style={[s.btnRow, { top: btnTop }]}>

        {/* RETAKE — always available */}
        <Pressable
          style={s.btn}
          onPress={handleRetake}
          accessibilityLabel="Retake photo"
        >
          <Text style={s.btnText}>RETAKE PHOTO</Text>
        </Pressable>

        {/* ADD TO CLOSET / ADDED */}
        {isConfirmed ? (
          <View style={[s.btn, s.btnAdded]}>
            <Ionicons name="checkmark" size={12} color={Colors.surface[150]} />
            <Text style={[s.btnText, s.btnTextMuted]}>ADDED</Text>
          </View>
        ) : (
          <Pressable
            style={[s.btn, isProcessing && s.btnDisabled]}
            onPress={handleAddToCloset}
            disabled={isProcessing}
            accessibilityLabel="Add to closet"
          >
            <Text style={[s.btnText, isProcessing && s.btnTextMuted]}>
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

  header: {
    position:      'absolute',
    left:          22,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
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

  carousel: {
    position: 'absolute',
    left:     0,
    right:    0,
  },
  carouselPage: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  heroWrap: {
    overflow: 'hidden',
    left:     8,
  },
  heroImage: {
    width:  '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width:           '100%',
    height:          '100%',
    backgroundColor: Colors.surface[20],
    borderRadius:    8,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,244,244,0.80)',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    borderRadius:    8,
  },
  errorOverlay: {
    backgroundColor: 'rgba(254,226,226,0.92)',
  },
  removingText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  errorText: {
    fontFamily:    FontFamily.sansMedium,
    fontSize:      11,
    lineHeight:    16,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color:         Colors.danger[200],
  },
  errorDetail: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    14,
    letterSpacing: -0.1,
    color:         Colors.danger[100],
    textAlign:     'center',
    paddingHorizontal: 16,
  },

  // Small confirmed checkmark overlay in the top-right of the photo
  confirmedBadge: {
    position:        'absolute',
    top:             10,
    right:           10,
    backgroundColor: 'rgba(245,244,244,0.85)',
    borderRadius:    50,
    padding:         4,
  },

  pageDots: {
    position:       'absolute',
    left:           0,
    right:          0,
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            6,
    zIndex:         10,
  },
  pageDot: {
    width:           5,
    height:          5,
    borderRadius:    2.5,
    backgroundColor: 'rgba(43,30,30,0.22)',
  },
  pageDotActive: {
    backgroundColor: Colors.surface[200],
  },
  pageDotConfirmed: {
    backgroundColor: Colors.surface[30],
  },

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

  btnRow: {
    position:      'absolute',
    left:          21,
    right:         20,
    flexDirection: 'row',
    gap:           14,
    zIndex:        10,
  },
  btn: {
    flex:            1,
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    paddingVertical: 10,
    alignItems:      'center',
    justifyContent:  'center',
    minHeight:       44,
    flexDirection:   'row',
    gap:             4,
  },
  btnAdded: {
    borderColor: Colors.surface[20],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  btnTextMuted: {
    color: Colors.surface[150],
  },

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
