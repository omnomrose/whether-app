// Figma node 542:49 — "onboard | closet (tops)"
// Category drill-down: shows all items of a single category in a 2-column grid.
//
// Layout (393 × 852 reference):
//   "< BACK" button:  left:22, top:89
//   Category title:   centred, top:83, Hedvig Letters Serif 24px
//   Search + Filter:  top:146, left:20, w:353
//   Item grid:        top:212, 2 columns (left:20, right:50%+6.5), each 170×149px
//   Nav:              GlassNavBar

import { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import GlassNavBar from '@/components/GlassNavBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useClosetStore, type ClothingItem } from '@/store/closetStore';

// ─── Figma frame reference (393 × 852) ───────────────────────────────────────
const FW = 393;
const FH = 852;

type ScanCategory = 'top' | 'bottom' | 'shoes';

const CATEGORY_LABELS: Record<ScanCategory, string> = {
  top:    'Tops',
  bottom: 'Bottoms',
  shoes:  'Shoes',
};

// ─── Item card — 170 × 149, floating image, no border ────────────────────────
function ItemCard({
  item,
  width,
  height,
  onPress,
}: {
  item:   ClothingItem;
  width:  number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[card.root, { width, height }]}
      onPress={onPress}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
        />
      ) : (
        <View style={card.placeholder} />
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  root: {
    padding: 10,
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    margin:          10,
    backgroundColor: Colors.surface[20],
    borderRadius:    4,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ClosetCategoryScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();
  const { category } = useLocalSearchParams<{ category: ScanCategory }>();

  const sx = (x: number) => (x / FW) * sw;
  const sy = (y: number) => (y / FH) * sh;

  const { items } = useClosetStore();
  const categoryItems = items.filter((i) => i.category === category);
  const title = CATEGORY_LABELS[category ?? 'top'] ?? 'Items';

  // Figma: items are 170px each in a 393px frame (2 columns, left:20, right:50%+6.5)
  // We scale to device width
  const ITEM_W = sx(170);
  const ITEM_H = sy(149);
  const COLUMN_GAP = sx(6.5) * 2; // gap between the two columns

  const handleItemPress = useCallback((id: string) => {
    router.push(`/closet-item?id=${id}` as any);
  }, []);

  const renderItem = useCallback(({ item }: { item: ClothingItem }) => (
    <ItemCard
      item={item}
      width={ITEM_W}
      height={ITEM_H}
      onPress={() => handleItemPress(item.id)}
    />
  ), [ITEM_W, ITEM_H, handleItemPress]);

  // Figma top:83+insets.top for both back button and title
  const headerTop = sy(83) + insets.top;

  return (
    <View style={s.root}>

      {/* ── Back button — Figma: left:22, top:89 ─────────────────────────────── */}
      <Pressable
        style={[s.backBtn, { top: headerTop + sy(6), left: sx(22) }]}
        onPress={() => router.back()}
        hitSlop={12}
      >
        <Ionicons name="chevron-back" size={10} color={Colors.surface[150]} />
        <Text style={s.backText}>BACK</Text>
      </Pressable>

      {/* ── Category title — centred, top:83 ─────────────────────────────────── */}
      <Text style={[s.title, { top: headerTop }]}>{title}</Text>

      {/* ── Search + Filter row — Figma: top:146, left:20, w:353 ─────────────── */}
      <View style={[s.searchRow, { top: sy(146) + insets.top, left: sx(20), width: sx(353) }]}>
        <View style={s.searchPill}>
          <Ionicons name="search-outline" size={12} color={Colors.surface[150]} />
          <Text style={s.searchPlaceholder}>SEARCH FOR...</Text>
        </View>
        <Pressable style={s.filterBtn} hitSlop={10}>
          <Ionicons name="options-outline" size={14} color={Colors.surface[150]} />
          <Text style={s.filterText}>FILTER</Text>
        </Pressable>
      </View>

      {/* ── 2-column item grid — Figma: top:212, 2 cols at left:20 and 50%+6.5 */}
      {categoryItems.length === 0 ? (
        <View style={[s.empty, { top: sy(212) + insets.top }]}>
          <Ionicons name="shirt-outline" size={32} color={Colors.surface[20]} />
          <Text style={s.emptyText}>NO {title.toUpperCase()} YET</Text>
        </View>
      ) : (
        <FlatList
          data={categoryItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          style={[s.list, { top: sy(212) + insets.top }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          columnWrapperStyle={{ gap: COLUMN_GAP, paddingHorizontal: sx(20) }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Nav bar ─────────────────────────────────────────────────────────── */}
      <GlassNavBar activeTab={0} />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.surface[100],
  },

  // ── Back button — Figma: chevron-left + "BACK" text, DM Mono 10px surface-150
  backBtn: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    zIndex:        10,
  },
  backText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  // ── Category title — Hedvig Letters Serif 24px #262222, centred
  title: {
    position:      'absolute',
    left:          0,
    right:         0,
    textAlign:     'center',
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         '#262222',
    zIndex:        5,
  },

  // ── Search + Filter ───────────────────────────────────────────────────────
  searchRow: {
    position:       'absolute',
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    zIndex:         5,
  },

  searchPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(38,34,34,0.3)',
    borderRadius:      4,
    width:             169,
  },
  searchPlaceholder: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  filterBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  filterText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  // ── Grid ─────────────────────────────────────────────────────────────────
  list: {
    position: 'absolute',
    left:     0,
    right:    0,
    bottom:   0,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  empty: {
    position:       'absolute',
    left:           0,
    right:          0,
    alignItems:     'center',
    gap:            12,
    paddingTop:     40,
  },
  emptyText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[20],
  },
});
