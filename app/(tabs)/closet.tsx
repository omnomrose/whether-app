// Figma node 144:124 — "onboard | closet overview"
//
// Layout (393 × 852 reference):
//   Profile circle:  top:61, centred, ø71
//   "Name's Closet": below circle, gap:16, serif 24px centred
//   Search + Filter: top:214, left:20, w:353
//   Categories:      top:276, gap:30 between sections
//   Nav:             GlassNavBar (floating pill, handled by component)

import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import GlassNavBar from '@/components/GlassNavBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useClosetStore, type ClothingItem } from '@/store/closetStore';
import { supabase } from '@/lib/supabase';
import { fetchClosetItems } from '@/lib/closet';

// ─── Category config ───────────────────────────────────────────────────────────
type ScanCategory = 'top' | 'bottom' | 'shoes';

const CATEGORIES: { key: ScanCategory; label: string }[] = [
  { key: 'top',    label: 'TOPS'    },
  { key: 'bottom', label: 'BOTTOMS' },
  { key: 'shoes',  label: 'SHOES'   },
];

// ─── Item sizing per category ──────────────────────────────────────────────────
// Matches Figma proportions: tops ~100px tall, bottoms ~120px, shoes ~65px landscape
const ITEM_H: Record<ScanCategory, number> = {
  top:    100,
  bottom: 120,
  shoes:  65,
};
const ITEM_W: Record<ScanCategory, number> = {
  top:    100,
  bottom: 90,
  shoes:  120,
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ uri, initial }: { uri: string | null; initial: string }) {
  return (
    <View style={av.wrap}>
      {uri ? (
        <Image source={{ uri }} style={av.img} resizeMode="cover" />
      ) : (
        <View style={av.placeholder}>
          <Text style={av.initial}>{initial.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const AVATAR_SIZE = 71;
const av = StyleSheet.create({
  wrap: {
    width:        AVATAR_SIZE,
    height:       AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow:     'hidden',
    alignSelf:    'center',
  },
  img: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  placeholder: {
    width:           AVATAR_SIZE,
    height:          AVATAR_SIZE,
    backgroundColor: Colors.surface[20],
    alignItems:      'center',
    justifyContent:  'center',
  },
  initial: {
    fontFamily: FontFamily.serif,
    fontSize:   28,
    color:      Colors.surface[150],
  },
});

// ─── Category section ──────────────────────────────────────────────────────────
function CategorySection({
  category,
  label,
  items,
  onItemPress,
  onCategoryPress,
  onAdd,
}: {
  category:        ScanCategory;
  label:           string;
  items:           ClothingItem[];
  onItemPress:     (id: string) => void;
  onCategoryPress: () => void;
  onAdd:           () => void;
}) {
  const h = ITEM_H[category];
  const w = ITEM_W[category];

  return (
    <View style={sec.root}>
      {/* Label row — tapping label navigates to category page */}
      <Pressable style={sec.labelRow} onPress={onCategoryPress} hitSlop={8}>
        <Text style={sec.label}>{label}</Text>
        <Pressable onPress={onAdd} hitSlop={10} style={sec.addBtn}>
          <Ionicons name="add" size={12} color={Colors.surface[150]} />
          <Text style={sec.addText}>ADD</Text>
        </Pressable>
      </Pressable>

      {/* Horizontal scroll of floating images — no × button */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[sec.scroll, { minHeight: h + 12 }]}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            style={[sec.item, { width: w, height: h }]}
            onPress={() => onItemPress(item.id)}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            ) : (
              <View style={sec.placeholder} />
            )}
          </Pressable>
        ))}

        {/* Empty slot if no items yet */}
        {items.length === 0 && (
          <Pressable onPress={onAdd} style={[sec.emptySlot, { width: w, height: h }]}>
            <Ionicons name="add" size={20} color={Colors.surface[20]} />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const sec = StyleSheet.create({
  root:     { gap: 8 },

  labelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingHorizontal: 20,
  },

  // Figma: DM Mono Regular 14px, #5b5a5a (≈ surface-150), uppercase
  label: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  addBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           2,
    marginLeft:    'auto',
  },
  addText: {
    fontFamily:    FontFamily.sans,
    fontSize:      11,
    lineHeight:    14,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  scroll: {
    paddingLeft:  20,
    paddingRight: 12,
    gap:          4,
    alignItems:   'center',
  },

  // Floating image — no border, no card background
  item: {
    position: 'relative',
  },

  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface[10],
  },

  emptySlot: {
    borderWidth:    1,
    borderStyle:    'dashed',
    borderColor:    Colors.surface[20],
    borderRadius:   4,
    alignItems:     'center',
    justifyContent: 'center',
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();

  const { items, setItems } = useClosetStore();

  const [userName,  setUserName]  = useState('My');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ── Load user info + closet from Supabase ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || cancelled) return;

      // Profile metadata
      const meta = session.user.user_metadata ?? {};
      const name = (meta.name ?? meta.full_name ?? '').trim();
      if (!cancelled && name) setUserName(name.split(' ')[0]); // first name only
      if (!cancelled && meta.avatar_url) setAvatarUrl(meta.avatar_url);

      // Fetch closet — only overwrite local store when cloud has items.
      // If cloud returns empty (e.g. table just created), keep local items.
      try {
        const cloudItems = await fetchClosetItems(session.user.id);
        if (!cancelled && cloudItems.length > 0) setItems(cloudItems);
      } catch (err) {
        console.warn('[closet] fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [setItems]);

  const handleItemPress = useCallback((id: string) => {
    router.push(`/closet-item?id=${id}` as any);
  }, []);

  const handleCategoryPress = useCallback((category: ScanCategory) => {
    router.push(`/closet-category?category=${category}` as any);
  }, []);

  const goToScan = useCallback(() => {
    router.push('/(onboarding)/closet-setup' as any);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const displayName = `${userName}'s Closet`;
  const initial     = userName.charAt(0);

  return (
    <View style={s.root}>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + 61, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile ─────────────────────────────────────────────────────────── */}
        {/* Figma: circle ø71 centred, gap:16 to name, name serif 24px */}
        <View style={s.profileSection}>
          <Avatar uri={avatarUrl} initial={initial} />
          <Text style={s.profileName}>{displayName}</Text>
        </View>

        {/* ── Search + Filter ──────────────────────────────────────────────────── */}
        {/* Figma top:214 — sits ~38px below profile section */}
        {/* left:20, width:353, search pill w:169, filter text right-aligned */}
        <View style={[s.searchRow, { width: sw - 40 }]}>
          <View style={s.searchPill}>
            <Ionicons name="search-outline" size={12} color={Colors.surface[150]} />
            <Text style={s.searchPlaceholder}>SEARCH FOR...</Text>
          </View>
          <Pressable style={s.filterBtn} hitSlop={10}>
            <Ionicons name="options-outline" size={14} color={Colors.surface[150]} />
            <Text style={s.filterText}>FILTER</Text>
          </Pressable>
        </View>

        {/* ── Categories ──────────────────────────────────────────────────────── */}
        {/* Figma: gap:30 between sections, starts at top:276 */}
        <View style={s.categories}>
          {CATEGORIES.map(({ key, label }) => (
            <CategorySection
              key={key}
              category={key}
              label={label}
              items={items.filter((i) => i.category === key)}
              onItemPress={handleItemPress}
              onCategoryPress={() => handleCategoryPress(key)}
              onAdd={goToScan}
            />
          ))}
        </View>

      </ScrollView>

      {/* ── Nav bar ─────────────────────────────────────────────────────────────── */}
      <GlassNavBar activeTab={0} />

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.surface[100],
  },

  scroll:        { flex: 1 },
  scrollContent: { alignItems: 'stretch' },

  // ── Profile section (centred column) ─────────────────────────────────────────
  // Figma: avatar top:61, gap:16 to name
  profileSection: {
    alignItems: 'center',
    gap:        16,
  },

  // Figma: Hedvig Letters Serif Regular 24px -1.2 #262222
  profileName: {
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         '#262222',
    textAlign:     'center',
  },

  // ── Search + Filter row ───────────────────────────────────────────────────────
  // Figma: left:20, top:214 → marginTop ~38px below profile section
  searchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    marginTop:         38,
    marginHorizontal:  20,
  },

  // Figma: border surface-30, rounded-4, px:8 py:4, w:169
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

  // Figma: DM Mono 10px -0.15 uppercase surface-150
  searchPlaceholder: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },

  // Figma: filter icon + "FILTER" text, DM Mono 12px #5b5a5a
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

  // ── Categories container ──────────────────────────────────────────────────────
  // Figma: starts top:276 (≈ 32px below search row), gap:30 between sections
  categories: {
    marginTop: 32,
    gap:       30,
  },
});
