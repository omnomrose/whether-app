// Figma node 144:124 — "onboard | closet overview" (main tab version)
//
// Shows every item the user has scanned, grouped into three categories:
//   TOPS (max 3 during onboarding) · BOTTOMS (max 2) · SHOES (max 1)
//
// Each item renders as a fixed-size card with the bg-removed photo
// and its tags listed below. Tapping a card opens a detail overlay
// (not yet built — placeholder for now).
//
// Layout (surface-100 bg, GlassNavBar at bottom):
//   Header:   top safe-area + 20px padding, left:20 "MY CLOSET" + count
//   Section:  category label row + horizontal scroll of item cards
//   Empty:    centred prompt → routes to closet-setup tutorial
//   Bottom:   insets.bottom + 76 (GlassNavBar height + gap)

import { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useClosetStore, type ClothingItem } from '@/store/closetStore';
import { supabase } from '@/lib/supabase';
import { fetchClosetItems, deleteClothingItem } from '@/lib/closet';

// ─── Types ────────────────────────────────────────────────────────────────────
type ScanCategory = 'top' | 'bottom' | 'shoes';

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES: { key: ScanCategory; label: string; max: number }[] = [
  { key: 'top',    label: 'TOPS',    max: 3 },
  { key: 'bottom', label: 'BOTTOMS', max: 2 },
  { key: 'shoes',  label: 'SHOES',   max: 1 },
];

// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  onRemove,
}: {
  item: ClothingItem;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={card.root}>
      {/* Photo */}
      <View style={card.imageWrap}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={card.image}
            resizeMode="contain"
          />
        ) : (
          <View style={card.imagePlaceholder} />
        )}

        {/* Remove × badge */}
        <Pressable
          style={card.removeBadge}
          onPress={() => onRemove(item.id)}
          hitSlop={8}
          accessibilityLabel="Remove from closet"
        >
          <Ionicons name="close" size={10} color={Colors.surface[100]} />
        </Pressable>
      </View>

      {/* Tags */}
      {item.tags.length > 0 && (
        <View style={card.tags}>
          {item.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={card.tagPill}>
              <Text style={card.tagText} numberOfLines={1}>{tag}</Text>
            </View>
          ))}
          {item.tags.length > 2 && (
            <Text style={card.tagMore}>+{item.tags.length - 2}</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Empty slot placeholder ───────────────────────────────────────────────────
function EmptySlot({ label }: { label: string }) {
  return (
    <View style={slot.root}>
      <View style={slot.imageWrap}>
        <Ionicons name="add" size={18} color={Colors.surface[20]} />
      </View>
      <Text style={slot.label}>{label}</Text>
    </View>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────
function CategorySection({
  label,
  items,
  max,
  onRemove,
  onAddMore,
}: {
  label:    string;
  items:    ClothingItem[];
  max:      number;
  onRemove: (id: string) => void;
  onAddMore: () => void;
}) {
  const filledCount = items.length;

  return (
    <View style={sec.root}>
      {/* Section header */}
      <View style={sec.header}>
        <Text style={sec.label}>{label}</Text>
        <Text style={sec.count}>{filledCount}/{max}</Text>
        {filledCount < max && (
          <Pressable style={sec.addBtn} onPress={onAddMore} hitSlop={8}>
            <Ionicons name="add" size={12} color={Colors.surface[200]} />
            <Text style={sec.addText}>ADD</Text>
          </Pressable>
        )}
      </View>

      {/* Horizontal scroll of cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sec.scroll}
      >
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onRemove={onRemove} />
        ))}
        {/* Empty slots for remaining spots */}
        {Array.from({ length: Math.max(0, max - filledCount) }).map((_, i) => (
          <Pressable key={`empty-${i}`} onPress={onAddMore}>
            <EmptySlot label="TAP TO ADD" />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();
  const { items, setItems, removeItem } = useClosetStore();

  // ── Load user's closet from Supabase on mount ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;
      try {
        const cloudItems = await fetchClosetItems(session.user.id);
        if (!cancelled) setItems(cloudItems);
      } catch (err) {
        console.warn('[closet] fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [setItems]);

  // ── Remove: delete from Supabase first, then local store ──────────────────
  const handleRemove = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    removeItem(id); // optimistic — remove from UI immediately
    try {
      await deleteClothingItem(id, item?.storagePath);
    } catch (err) {
      // Re-add on failure
      if (item) {
        const { setItems: si, items: current } = useClosetStore.getState();
        si([...current, item]);
      }
      Alert.alert('Could not delete', 'Please try again.');
    }
  }, [items, removeItem]);

  const goToScan = useCallback(() => {
    router.push('/(onboarding)/closet-setup' as any);
  }, []);

  const totalItems = items.length;
  const hasItems   = totalItems > 0;

  // ── Compute card width based on screen (3 visible at a glance on typical phone)
  // Cards are fixed 104px; left-edge items peek out at 20px from screen edge.
  // But we hard-code 104 and let the horizontal scroll do the rest.

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.title}>MY CLOSET</Text>
          {hasItems && (
            <View style={s.countBadge}>
              <Text style={s.countBadgeText}>{totalItems}</Text>
            </View>
          )}
        </View>

        <Pressable style={s.scanBtn} onPress={goToScan} hitSlop={8}>
          <Ionicons name="camera-outline" size={14} color={Colors.surface[200]} />
          <Text style={s.scanBtnText}>RESCAN</Text>
        </Pressable>
      </View>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!hasItems && (
        <View style={s.emptyState}>
          <Ionicons name="shirt-outline" size={40} color={Colors.surface[20]} />
          <Text style={s.emptyTitle}>YOUR CLOSET IS EMPTY</Text>
          <Text style={s.emptyBody}>
            Scan your clothes to build a digital wardrobe.
          </Text>
          <Pressable style={s.emptyBtn} onPress={goToScan}>
            <Ionicons name="camera-outline" size={14} color={Colors.surface[200]} />
            <Text style={s.emptyBtnText}>START SCANNING</Text>
          </Pressable>
        </View>
      )}

      {/* ── Category sections ─────────────────────────────────────────────────── */}
      {hasItems && (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={[
            s.scrollContent,
            { paddingBottom: insets.bottom + 92 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {CATEGORIES.map(({ key, label, max }) => {
            const categoryItems = items.filter(
              (item) => item.category === key
            );
            return (
              <CategorySection
                key={key}
                label={label}
                items={categoryItems}
                max={max}
                onRemove={handleRemove}
                onAddMore={goToScan}
              />
            );
          })}
        </ScrollView>
      )}

    </View>
  );
}

// ─── Screen styles ─────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.surface[100],
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  title: {
    fontFamily:    FontFamily.sans,
    fontSize:      20,
    lineHeight:    24,
    letterSpacing: -1,
    color:         Colors.surface[200],
  },
  countBadge: {
    backgroundColor: Colors.surface[200],
    borderRadius:    10,
    paddingHorizontal: 7,
    paddingVertical:   2,
    minWidth:          20,
    alignItems:        'center',
  },
  countBadgeText: {
    fontFamily:    FontFamily.sans,
    fontSize:      11,
    lineHeight:    15,
    letterSpacing: -0.15,
    color:         Colors.surface[100],
  },

  // Rescan button
  scanBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
    borderRadius:      20,
  },
  scanBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 4, gap: 32 },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            16,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    textAlign:     'center',
  },
  emptyBody: {
    fontFamily:    FontFamily.sans,
    fontSize:      13,
    lineHeight:    18,
    letterSpacing: -0.2,
    color:         Colors.surface[150],
    textAlign:     'center',
  },
  emptyBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    marginTop:         8,
    paddingHorizontal: 20,
    paddingVertical:   10,
    backgroundColor:   Colors.surface[200],
    borderRadius:      20,
  },
  emptyBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      13,
    lineHeight:    17,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
    color:         Colors.surface[100],
  },
});

// ─── Section styles ────────────────────────────────────────────────────────────
const sec = StyleSheet.create({
  root: { gap: 12 },

  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 20,
  },
  label: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  count: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[150],
  },
  addBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           3,
    marginLeft:    'auto',
  },
  addText: {
    fontFamily:    FontFamily.sans,
    fontSize:      11,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  scroll: {
    paddingLeft:  20,
    paddingRight: 8,
    gap:          12,
  },
});

// ─── Item card styles (104 × 128 total: 104 image + 24 tags) ──────────────────
const CARD_IMG = 104;

const card = StyleSheet.create({
  root: {
    width: CARD_IMG,
    gap:   8,
  },
  imageWrap: {
    width:           CARD_IMG,
    height:          CARD_IMG,
    backgroundColor: Colors.surface[10],
    borderRadius:    8,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     'rgba(43,30,30,0.06)',
  },
  image: {
    width:  CARD_IMG,
    height: CARD_IMG,
  },
  imagePlaceholder: {
    flex:            1,
    backgroundColor: Colors.surface[20],
  },
  removeBadge: {
    position:        'absolute',
    top:             6,
    right:           6,
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: Colors.surface[200],
    alignItems:      'center',
    justifyContent:  'center',
  },
  tags: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
    alignItems:    'center',
  },
  tagPill: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      3,
    backgroundColor:   Colors.primary[100],
    maxWidth:          90,
  },
  tagText: {
    fontFamily:    FontFamily.sans,
    fontSize:      9,
    lineHeight:    13,
    letterSpacing: -0.1,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  tagMore: {
    fontFamily:    FontFamily.sans,
    fontSize:      9,
    lineHeight:    13,
    color:         Colors.surface[150],
  },
});

// ─── Empty slot styles ─────────────────────────────────────────────────────────
const slot = StyleSheet.create({
  root: {
    width: CARD_IMG,
    gap:   8,
  },
  imageWrap: {
    width:           CARD_IMG,
    height:          CARD_IMG,
    backgroundColor: 'transparent',
    borderRadius:    8,
    borderWidth:     1,
    borderStyle:     'dashed',
    borderColor:     Colors.surface[20],
    alignItems:      'center',
    justifyContent:  'center',
  },
  label: {
    fontFamily:    FontFamily.sans,
    fontSize:      9,
    lineHeight:    12,
    letterSpacing: -0.1,
    textTransform: 'uppercase',
    color:         Colors.surface[20],
    textAlign:     'center',
  },
});
