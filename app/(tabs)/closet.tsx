// Figma nodes 664:46 "closet | overview | list" + 675:186 "closet | overview | grid"
//
// Layout (393 × 852 reference):
//   Profile circle:  top:61, centred, ø71
//   Settings gear:   top:61, right:20, 20×20
//   "Name's Closet": below circle, gap:16, serif 24px centred
//   Search + switch: top:214, left:20, w:353 — search box w:231 (radius 4,
//                    border surface-30, px:12 py:8) + "SWITCH VIEW" link
//   Sections (list): top:276, gap:30 — header "TOPS [3]" + "See all"
//   Grid view:       2-col category cards, 170w, collaged images + label
//   Nav:             NavBar (floating pill, handled by component)

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import NavBar from '@/components/NavBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useClosetStore, type ClothingItem } from '@/store/closetStore';
import { supabase } from '@/lib/supabase';
import { fetchClosetItems, migrateClosetTags } from '@/lib/closet';
import { parseTags } from '@/lib/claude';

// ─── Category config ───────────────────────────────────────────────────────────
type ClosetCategory = ClothingItem['category'];

// Grid pairs (Figma 675:186 + additions): tops|outerwear, bottoms|shoes,
// accessories|jewelry
const CATEGORIES: { key: ClosetCategory; label: string }[] = [
  { key: 'top',       label: 'TOPS'        },
  { key: 'outerwear', label: 'OUTERWEAR'   },
  { key: 'bottom',    label: 'BOTTOMS'     },
  { key: 'shoes',     label: 'SHOES'       },
  { key: 'accessory', label: 'ACCESSORIES' },
  { key: 'jewelry',   label: 'JEWELRY'     },
];

// ─── Item sizing per category (list view) ──────────────────────────────────────
// Figma 664:46: tops ~100px tall, bottoms ~120px, shoes ~55px landscape
const ITEM_H: Record<string, number> = { top: 100, outerwear: 100, bottom: 120, shoes: 65,  accessory: 65, jewelry: 65 };
const ITEM_W: Record<string, number> = { top: 100, outerwear: 100, bottom: 90,  shoes: 120, accessory: 65, jewelry: 65 };

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
  img: { width: AVATAR_SIZE, height: AVATAR_SIZE },
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

// ─── Category section (list view) ───────────────────────────────────────────────
function CategorySection({
  category,
  label,
  items,
  onItemPress,
  onSeeAll,
}: {
  category:    ClosetCategory;
  label:       string;
  items:       ClothingItem[];
  onItemPress: (id: string) => void;
  onSeeAll:    () => void;
}) {
  const h = ITEM_H[category] ?? 100;
  const w = ITEM_W[category] ?? 100;

  return (
    <View style={sec.root}>
      {/* Header row — Figma 664:54: "tops [3]" left, "See all" right */}
      <View style={sec.labelRow}>
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={sec.label}>{label} [{items.length}]</Text>
        </Pressable>
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text style={sec.seeAll}>See all</Text>
        </Pressable>
      </View>

      {/* Horizontal scroll of floating images */}
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

        {items.length === 0 && (
          <View style={[sec.emptySlot, { width: w, height: h }]}>
            <Ionicons name="add" size={20} color={Colors.surface[20]} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const sec = StyleSheet.create({
  root: { gap: 12 },

  labelRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
  },

  // Figma 664:55 — DM Mono 14px, #5b5a5a, uppercase
  label: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         '#5b5a5a',
  },

  // Figma 664:56 — DM Mono 12px, #5b5a5a ("See all", not uppercased in design)
  seeAll: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         '#5b5a5a',
  },

  scroll: {
    paddingLeft:  20,
    paddingRight: 12,
    gap:          4,
    alignItems:   'center',
  },

  item:        { position: 'relative' },
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

// ─── Category card (grid view) — Figma 675:186 ─────────────────────────────────
// Tops/bottoms cards are tall (h:175) with a fanned image collage:
//   item 0 → straight, item 1 → rotated −30°, item 2 → rotated +15°
// Shoes/accessories cards are short (h:109) with one straight image.
function CategoryCard({
  category,
  label,
  items,
  onPress,
}: {
  category: ClosetCategory;
  label:    string;
  items:    ClothingItem[];
  onPress:  () => void;
}) {
  // Clothing cards (tops/outerwear/bottoms) are tall with fanned collages;
  // shoes/accessories/jewelry are short single-image cards.
  const tall    = category === 'top' || category === 'bottom' || category === 'outerwear';
  const collage = items.slice(0, tall ? 3 : 1);

  // Figma fan transforms (675:279 / 675:324)
  const FAN: { rotate: string; dx: number; dy: number; z: number }[] = tall
    ? [
        { rotate: '0deg',   dx: 8,  dy: 10, z: 1 },  // straight, nudged in
        { rotate: '-30deg', dx: -8, dy: 4,  z: 2 },  // fanned left
        { rotate: '15deg',  dx: 10, dy: 0,  z: 3 },  // fanned right, on top
      ]
    : [{ rotate: '0deg', dx: 0, dy: 0, z: 1 }];

  return (
    <Pressable
      style={[grid.card, tall ? grid.cardTall : grid.cardShort]}
      onPress={onPress}
    >
      <View style={[grid.collage, tall ? grid.collageTall : grid.collageShort]}>
        {collage.length === 0 && (
          <View style={grid.cardEmpty}>
            <Ionicons name="add" size={20} color={Colors.surface[20]} />
          </View>
        )}
        {collage.map((item, i) => {
          const fan = FAN[Math.min(i, FAN.length - 1)];
          return (
            <Image
              key={item.id}
              source={{ uri: item.imageUrl }}
              style={[
                tall ? grid.collageImgTall : grid.collageImgShort,
                {
                  zIndex:    fan.z,
                  transform: [
                    { translateX: fan.dx },
                    { translateY: fan.dy },
                    { rotate: fan.rotate },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          );
        })}
      </View>
      <Text style={grid.cardLabel}>{label} [{items.length}]</Text>
    </Pressable>
  );
}

const grid = StyleSheet.create({
  // Figma 675:186 — 2-up grid: cols at x:20 and 50%+6.5 → 13px column gap,
  // 30px row gap. columnGap must stay 13 (170+170+13 = 353 = inner width);
  // anything larger forces single-column wrapping.
  wrap: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    marginTop:         32,
    rowGap:            30,
    columnGap:         13,
  },
  // Figma card: w:170, bg surface-100, radius 4, px:16 py:8, centred column
  card: {
    width:             170,
    alignItems:        'center',
    justifyContent:    'flex-end',
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      4,
    backgroundColor:   Colors.surface[100],
    overflow:          'hidden',   // keep fanned images inside the card
  },
  // Tops/bottoms — Figma 675:280/310: h:174.8, gap 12 between collage + label
  cardTall:  { height: 175, gap: 12 },
  // Shoes/accessories — Figma 675:422/433: h:109, gap 16
  cardShort: { height: 109, gap: 16 },

  collage: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Figma 675:279: collage box ≈ 139 × 128
  collageTall:  { width: 139, height: 128 },
  // Figma 675:423: single image row ≈ 102 × 59
  collageShort: { width: 102, height: 59 },

  collageImgTall: {
    position: 'absolute',
    width:    100,
    height:   105,
  },
  collageImgShort: {
    width:  102,
    height: 59,
  },

  cardEmpty: {
    width:          80,
    height:         55,
    borderWidth:    1,
    borderStyle:    'dashed',
    borderColor:    Colors.surface[20],
    borderRadius:   4,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Figma 675:194 — DM Mono 14px surface-200 uppercase, centred under collage
  cardLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    textAlign:     'center',
  },
});

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function ClosetScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw } = useWindowDimensions();

  const { items, setItems, updateItem } = useClosetStore();

  const [userName,  setUserName]  = useState('My');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [query,     setQuery]     = useState('');
  const [view,      setView]      = useState<'list' | 'grid'>('list');

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

      // Fetch closet, merge with any local-only items (failed uploads),
      // then retag EVERY item that lacks filterable type/colour tags.
      try {
        const cloudItems = await fetchClosetItems(session.user.id);
        if (cancelled) return;

        const localItems = useClosetStore.getState().items;
        const cloudIds   = new Set(cloudItems.map((i) => i.id));
        const localOnly  = localItems.filter((i) => !cloudIds.has(i.id));
        const merged     = cloudItems.length > 0
          ? [...cloudItems, ...localOnly]
          : localItems;

        if (cloudItems.length > 0) setItems(merged);

        // Background migration: give every unfiltered item [type, style, colour]
        migrateClosetTags(merged).then((updated) => {
          if (cancelled) return;
          Object.entries(updated).forEach(([id, tags]) => {
            updateItem(id, { tags, clothingTags: parseTags(tags) });
          });
        }).catch(() => {});
      } catch (err) {
        console.warn('[closet] fetch failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [setItems]);

  const handleItemPress = useCallback((id: string) => {
    router.push(`/closet-item?id=${id}` as any);
  }, []);

  const handleSeeAll = useCallback((category: ClosetCategory) => {
    router.push(`/closet-category?category=${category}` as any);
  }, []);

  const handleSettings = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }, []);

  // ── Search — live-match items on tags + category label ──────────────────────
  const filteredItems = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return items;
    return items.filter((i) => {
      const haystack = [
        i.category,
        ...(i.tags ?? []),
      ].join(' ').toUpperCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const sections = CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    items: filteredItems.filter((i) => i.category === key),
  }));

  // While searching, hide sections with no matches
  const visibleSections = query.trim()
    ? sections.filter((s) => s.items.length > 0)
    : sections;

  // ── Derived ───────────────────────────────────────────────────────────────────
  const displayName = `${userName}'s Closet`;
  const initial     = userName.charAt(0);

  return (
    <View style={s.root}>

      {/* ── Settings gear — Figma 675:471: top-right ───────────────────────── */}
      <Pressable
        style={[s.settingsBtn, { top: insets.top + 24 }]}
        onPress={handleSettings}
        hitSlop={10}
      >
        <Ionicons name="settings-outline" size={20} color={Colors.surface[200]} />
      </Pressable>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          { paddingTop: insets.top + 61, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Profile ─────────────────────────────────────────────────────────── */}
        <View style={s.profileSection}>
          <Avatar uri={avatarUrl} initial={initial} />
          <Text style={s.profileName}>{displayName}</Text>
        </View>

        {/* ── Search + Switch view — Figma 664:74 ─────────────────────────────── */}
        <View style={[s.searchRow, { width: sw - 40 }]}>
          {/* Search box — w:231, border surface-30, radius 4, px:12 py:8 */}
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={12} color={Colors.surface[150]} />
            <TextInput
              style={s.searchInput}
              placeholder="SEARCH FOR..."
              placeholderTextColor={Colors.surface[150]}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close" size={12} color={Colors.surface[150]} />
              </Pressable>
            )}
          </View>

          {/* SWITCH VIEW — toggles list ↔ grid (Figma 664:78 / 675:226) */}
          <Pressable
            style={s.switchBtn}
            hitSlop={10}
            onPress={() => setView((v) => (v === 'list' ? 'grid' : 'list'))}
          >
            <Ionicons
              name={view === 'list' ? 'grid-outline' : 'list-outline'}
              size={14}
              color={'#5b5a5a'}
            />
            <Text style={s.switchText}>SWITCH VIEW</Text>
          </Pressable>
        </View>

        {/* ── Sections — list (664:46) or grid (675:186) ─────────────────────── */}
        {view === 'list' ? (
          <View style={s.categories}>
            {visibleSections.map(({ key, label, items: sectionItems }) => (
              <CategorySection
                key={key}
                category={key}
                label={label}
                items={sectionItems}
                onItemPress={handleItemPress}
                onSeeAll={() => handleSeeAll(key)}
              />
            ))}
          </View>
        ) : (
          <View style={grid.wrap}>
            {visibleSections.map(({ key, label, items: sectionItems }) => (
              <CategoryCard
                key={key}
                category={key}
                label={label}
                items={sectionItems}
                onPress={() => handleSeeAll(key)}
              />
            ))}
          </View>
        )}

        {/* No search results */}
        {query.trim().length > 0 && visibleSections.length === 0 && (
          <Text style={s.noResults}>NOTHING MATCHES “{query.trim()}”</Text>
        )}

      </ScrollView>

      {/* ── Nav bar ─────────────────────────────────────────────────────────────── */}
      <NavBar activeTab={0} />

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

  settingsBtn: {
    position: 'absolute',
    right:    20,
    zIndex:   20,
  },

  // ── Profile section ──────────────────────────────────────────────────────────
  profileSection: {
    alignItems: 'center',
    gap:        16,
  },
  profileName: {
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         '#262222',
    textAlign:     'center',
  },

  // ── Search + switch row — Figma 664:74: top:214, w:353 ─────────────────────
  searchRow: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    marginTop:        38,
    marginHorizontal: 20,
  },

  // Figma 664:75 — w:231, border surface-30, radius 4, px:12 py:8, gap:20
  searchBox: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(38,34,34,0.3)',
    borderRadius:      4,
    width:             231,
    minHeight:         32,
  },
  searchInput: {
    flex:          1,
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    letterSpacing: -0.18,
    color:         Colors.surface[200],
    paddingVertical: 0,
  },

  // Figma 664:78 — icon + "SWITCH VIEW", DM Mono 12px #5b5a5a
  switchBtn: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  switchText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         '#5b5a5a',
  },

  // ── Sections container — Figma: top:276, gap:30 ─────────────────────────────
  categories: {
    marginTop: 32,
    gap:       30,
  },

  noResults: {
    marginTop:     40,
    textAlign:     'center',
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[30],
  },
});
