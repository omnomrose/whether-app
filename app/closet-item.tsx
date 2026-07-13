// Figma node 453:35 — "clothing details popup"
//
// Modal that slides up when a clothing item is tapped from the closet.
// Shows the bg-removed photo, item label, tags, add-tag input, and
// UPDATE CLOSET / REMOVE ITEM actions.
//
// Layout (393 × 852 reference):
//   Gradient overlay: top:46, h:686 (transparent → surface-100)
//   Photo:            left:42, top:111, size:309
//   ⌄ close chevron:  top:73, left:20
//   Item label:       left:~170, top:124, DM Mono 16px surface-150
//   REMOVE ITEM:      top:62, right:~18
//   Suggested tags:   left:21, top:438, w:314
//   Tag input:        left:20, top:586, w:353
//   UPDATE CLOSET:    centred, top:660, w:211

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useClosetStore } from '@/store/closetStore';
import { updateClothingTags, updateClothingName, deleteClothingItem, retagClosetItem } from '@/lib/closet';
import { parseTags } from '@/lib/claude';

// ─── Figma frame reference (393 × 852) ───────────────────────────────────────
const FW = 393;
const FH = 852;

// Every clothing item must carry 1–3 tags
const MIN_TAGS = 1;
const MAX_TAGS = 3;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ClosetItemScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();

  const sx = (x: number) => (x / FW) * sw;
  const sy = (y: number) => (y / FH) * sh;

  const { items, updateItem, removeItem } = useClosetStore();
  const item = items.find((i) => i.id === id);

  // ── Tags state ──────────────────────────────────────────────────────────────
  const [selectedTags, setSelectedTags] = useState<string[]>(item?.tags ?? []);
  const [customInput,  setCustomInput]  = useState('');
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [tagging,      setTagging]      = useState(false);

  // ── Rename ──────────────────────────────────────────────────────────────────
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState('');

  // ── Self-heal: item opened with no tags → auto-tag it right here ───────────
  // (Figma 667:123 always shows suggested tag pills; an empty section means
  // the background migration hasn't reached this item yet.)
  useEffect(() => {
    if (!item || item.tags.length > 0 || tagging) return;
    let cancelled = false;
    setTagging(true);
    retagClosetItem(item)
      .then((tags) => {
        if (cancelled || tags.length === 0) return;
        updateItem(item.id, { tags, clothingTags: parseTags(tags) });
        setSelectedTags(tags);
      })
      .catch((err) => console.warn('[closet-item] auto-tag failed:', err))
      .finally(() => { if (!cancelled) setTagging(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  // 1–3 tags enforced: deselect always allowed, select capped at MAX_TAGS
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  }, []);

  const handleAddCustomTag = useCallback(() => {
    const trimmed = customInput.trim().toUpperCase();
    if (!trimmed) return;
    setSelectedTags((prev) =>
      prev.includes(trimmed) || prev.length >= MAX_TAGS ? prev : [...prev, trimmed]
    );
    setCustomInput('');
  }, [customInput]);

  // ── Update closet ────────────────────────────────────────────────────────────
  const handleUpdate = useCallback(async () => {
    if (!item || saving) return;
    if (selectedTags.length < MIN_TAGS) {
      Alert.alert('Add a tag', 'Every item needs at least one tag (max 3).');
      return;
    }
    setSaving(true);
    try {
      await updateClothingTags(item.id, selectedTags);
      updateItem(item.id, { tags: selectedTags });
      router.back();
    } catch (err: unknown) {
      Alert.alert('Could not save', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [item, saving, selectedTags, updateItem]);

  // ── Remove item ──────────────────────────────────────────────────────────────
  const handleRemove = useCallback(() => {
    if (!item) return;
    Alert.alert(
      'Remove item?',
      'This will permanently delete it from your closet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteClothingItem(item.id, item.storagePath);
              removeItem(item.id);
              router.back();
            } catch (err: unknown) {
              Alert.alert('Could not remove', err instanceof Error ? err.message : String(err));
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [item, removeItem]);

  // ── Item label ("TOP#1", "BOTTOM#2", etc.) ────────────────────────────────
  const itemLabel = (() => {
    if (!item) return '';
    const sameCategory = items.filter((i) => i.category === item.category);
    const idx = sameCategory.findIndex((i) => i.id === item.id) + 1;
    const labelMap: Record<string, string> = {
      top:       'TOP',
      bottom:    'BOTTOM',
      shoes:     'SHOES',
      accessory: 'ACCESSORY',
      outerwear: 'OUTERWEAR',
      jewelry:   'JEWELRY',
    };
    return `${labelMap[item.category] ?? item.category.toUpperCase()}#${idx}`;
  })();

  const displayName = item?.name || itemLabel;

  const startRename = useCallback(() => {
    setNameInput(item?.name ?? '');
    setEditingName(true);
  }, [item?.name]);

  const commitRename = useCallback(() => {
    setEditingName(false);
    if (!item) return;
    const trimmed = nameInput.trim().toUpperCase();
    if (trimmed === (item.name ?? '')) return;
    // Empty input clears the custom name → falls back to "TOP#1" label
    updateItem(item.id, { name: trimmed || undefined });
    updateClothingName(item.id, trimmed || null); // best-effort cloud sync
  }, [item, nameInput, updateItem]);

  // ── Figma layout values ────────────────────────────────────────────────────
  const gradTop    = sy(46);
  const gradH      = sy(686);
  const photoLeft  = sx(42);
  const photoTop   = sy(111);
  const photoSize  = sx(309);
  const labelLeft  = sx(170);
  const labelTop   = sy(124) + insets.top;
  const closeTop   = sy(73)  + insets.top;
  const closeLeft  = sx(20);
  const removeTop  = sy(62)  + insets.top;
  const tagsTop    = sy(438);
  const inputTop   = sy(586);
  const btnTop     = sy(660);
  const btnLeft    = (sw - sx(211)) / 2;

  if (!item) {
    return (
      <View style={[s.root, s.centred]}>
        <Text style={s.notFound}>Item not found</Text>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.root}>

      {/* ── Background photo — fills screen behind gradient ──────────────────── */}
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={[s.photoBg, { left: photoLeft, top: photoTop, width: photoSize, height: photoSize }]}
          resizeMode="contain"
        />
      )}

      {/* ── Gradient — transparent top → surface-100 bottom ─────────────────── */}
      {/* Figma 144:233: gradient starts at top:46 */}
      <LinearGradient
        colors={['rgba(245,244,244,0)', 'rgba(245,244,244,0.31)', Colors.surface[100]]}
        locations={[0, 0.245, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.gradient, { top: gradTop, height: gradH }]}
        pointerEvents="none"
      />

      {/* ── Close chevron — Figma: top:73, left:20 ───────────────────────────── */}
      <Pressable
        style={[s.closeBtn, { top: closeTop, left: closeLeft }]}
        onPress={() => router.back()}
        hitSlop={16}
      >
        <Ionicons name="chevron-down" size={18} color={Colors.surface[200]} />
      </Pressable>

      {/* ── Item label "TOP#1" + rename pencil — Figma 563:162 ──────────────── */}
      <View style={[s.labelRow, { top: labelTop }]}>
        {editingName ? (
          <TextInput
            style={[s.itemLabel, s.nameInput]}
            value={nameInput}
            onChangeText={setNameInput}
            onSubmitEditing={commitRename}
            onBlur={commitRename}
            placeholder={itemLabel}
            placeholderTextColor={Colors.surface[30]}
            autoFocus
            autoCapitalize="characters"
            returnKeyType="done"
            maxLength={24}
          />
        ) : (
          <Pressable style={s.labelPress} onPress={startRename} hitSlop={8}>
            <Text style={s.itemLabel} numberOfLines={1}>{displayName}</Text>
            <Ionicons name="pencil-outline" size={13} color={Colors.surface[150]} />
          </Pressable>
        )}
      </View>

      {/* ── "REMOVE ITEM" — top-right, replaces "RETAKE PHOTO" for closet ────── */}
      <Pressable
        style={[s.removeBtn, { top: removeTop, right: sx(18) }]}
        onPress={handleRemove}
        disabled={deleting}
        hitSlop={12}
      >
        {deleting
          ? <ActivityIndicator size="small" color={Colors.surface[200]} />
          : <Text style={s.removeBtnText}>REMOVE ITEM</Text>
        }
      </Pressable>

      {/* ── Tags + input + button — on surface-100 area ──────────────────────── */}

      {/* Suggested tags section — Figma: left:21, top:438 */}
      <View style={[s.tagsSection, { top: tagsTop, left: sx(21), width: sx(314) }]}>
        <View style={s.tagsSectionHeader}>
          <Ionicons name="add" size={10} color={Colors.surface[200]} />
          <Text style={s.tagsSectionLabel}>SUGGESTED TAGS</Text>
        </View>
        {tagging ? (
          <View style={s.taggingRow}>
            <ActivityIndicator size="small" color={Colors.surface[150]} />
            <Text style={s.taggingText}>ANALYSING...</Text>
          </View>
        ) : (
          <View style={s.tagsList}>
            {selectedTags.map((tag) => (
              <Pressable
                key={tag}
                style={[s.tagPill, s.tagPillActive]}
                onPress={() => toggleTag(tag)}
                hitSlop={6}
              >
                <Text style={[s.tagText, s.tagTextActive]}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* "+ ADD TAGS..." input — Figma: top:586, left:20, w:353 */}
      <View style={[s.inputWrap, { top: inputTop, left: sx(20), width: sx(353) }]}>
        <Ionicons name="add" size={12} color={Colors.surface[150]} />
        <TextInput
          style={s.input}
          placeholder="ADD TAGS..."
          placeholderTextColor={Colors.surface[150]}
          value={customInput}
          onChangeText={setCustomInput}
          onSubmitEditing={handleAddCustomTag}
          returnKeyType="done"
          autoCapitalize="characters"
        />
      </View>

      {/* "UPDATE CLOSET" button — Figma: top:660, centred, w:211 */}
      <Pressable
        style={[
          s.updateBtn,
          { top: btnTop, left: btnLeft, width: sx(211) },
          (saving || selectedTags.length < MIN_TAGS) && s.updateBtnLoading,
        ]}
        onPress={handleUpdate}
        disabled={saving || selectedTags.length < MIN_TAGS}
      >
        {saving
          ? <ActivityIndicator size="small" color={Colors.surface[100]} />
          : <Text style={s.updateBtnText}>UPDATE CLOSET</Text>
        }
      </Pressable>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.surface[100],
  },
  centred: {
    justifyContent: 'center',
    alignItems:     'center',
    gap:            16,
  },

  // Photo — absolute, ABOVE the gradient (under it the image looks faded/washed)
  photoBg: {
    position: 'absolute',
    zIndex:   3,
  },

  // Gradient overlay
  gradient: {
    position: 'absolute',
    left:     0,
    right:    0,
    zIndex:   2,
  },

  // Close chevron
  closeBtn: {
    position: 'absolute',
    zIndex:   10,
  },

  // Label row — centred, holds name/input + pencil
  labelRow: {
    position:       'absolute',
    left:           0,
    right:          0,
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         10,
  },
  labelPress: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    maxWidth:      '80%',
  },
  nameInput: {
    minWidth:  120,
    textAlign: 'center',
    padding:   0,
  },
  // "TOP#1" label — DM Mono 16px -0.8 surface-150
  itemLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
    zIndex:        10,
  },

  // REMOVE ITEM — top-right text link
  removeBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  removeBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // Tags section
  tagsSection: {
    position: 'absolute',
    gap:      12,
    zIndex:   5,
  },
  tagsSectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  tagsSectionLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           11,
    alignItems:    'center',
  },
  taggingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  taggingText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  // Figma 667:132 — px:16, py:8, r:4, border surface-200 (32px tall)
  tagPill: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      4,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
    alignItems:        'center',
    justifyContent:    'center',
  },
  tagPillActive: {
    backgroundColor: Colors.primary[100],
  },
  tagText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  tagTextActive: {
    color: Colors.surface[200],
  },

  // Tag input
  inputWrap: {
    position:          'absolute',
    height:            41,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 20,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
    borderRadius:      4,
    backgroundColor:   Colors.surface[100],
    zIndex:            5,
  },
  input: {
    flex:          1,
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    color:         Colors.surface[200],
  },

  // UPDATE CLOSET button — Figma 667:142: primary-100 fill, surface-200 text
  updateBtn: {
    position:          'absolute',
    height:            40,
    backgroundColor:   Colors.primary[100],
    borderRadius:      4,
    alignItems:        'center',
    justifyContent:    'center',
    zIndex:            5,
  },
  updateBtnLoading: { opacity: 0.65 },
  updateBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  notFound: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    letterSpacing: -0.28,
    color:         Colors.surface[150],
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical:   10,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
  },
  backBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
});
