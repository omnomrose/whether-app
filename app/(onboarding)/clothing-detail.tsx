// Figma node 453:35 — "clothing details popup"
//
// Reached from photo-confirm after tapping "YES, ADD TO CLOSET".
// Shows the bg-removed photo, AI-suggested tags, tag input, and
// an "UPDATE CLOSET" button that finalises the item.
//
// Annotations:
//   • ⌄ back chevron (top-left): back to photo-confirm
//   • "RETAKE PHOTO" (top-right): remove from session → back to camera
//   • "SUGGESTED TAGS": pre-selected AI tags (first one highlighted primary-100)
//   • "ADD TAGS..." input: user can type custom tags
//   • "UPDATE CLOSET": addItem to closetStore + confirmToCloset → back
//
// Layout (Figma 393×852):
//   Gradient overlay: top:46, h:686 (transparent top → surface-100 bottom)
//   Photo:            left:42, top:111, size:309
//   "TOP#1" label:    left≈151, top:124, 16/20px surface-150
//   "RETAKE PHOTO":   top:62, right≈18 (calc 66.67%+22px from left = 284px)
//   Back chevron:     top≈73, left≈20
//   Suggested tags:   top:438, left:21
//   Tag input:        top:586, left:20, w:353
//   UPDATE CLOSET:    top:660, centred, w:211, dark pill

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useScanStore, type ScanCategory } from '@/store/scanStore';
import { useClosetStore } from '@/store/closetStore';
import { supabase } from '@/lib/supabase';
import { uploadClothingPhoto, saveClothingItem } from '@/lib/closet';
import { tagClothingItemStructured, flattenTags } from '@/lib/claude';

// ─── Figma frame reference ─────────────────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Fallback tags (type, style, colour) if Claude is unavailable ─────────────
const FALLBACK_TAGS: Record<ScanCategory, [string, string, string]> = {
  top:    ['T-SHIRT', 'CASUAL', 'WHITE'],
  bottom: ['JEANS',   'CASUAL', 'BLACK'],
  shoes:  ['SNEAKERS','CASUAL', 'WHITE'],
};

export default function ClothingDetailScreen() {
  const insets = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

  const sx = (x: number) => (x / FW) * sw;
  const sy = (y: number) => (y / FH) * sh;

  const { photoId } = useLocalSearchParams<{ photoId: string }>();

  // ── Store ──────────────────────────────────────────────────────────────────
  const { photos, retakePhoto, confirmToCloset } = useScanStore();
  const { addItem, removeItem }                  = useClosetStore();

  const photo = photos.find((p) => p.id === photoId);

  // ── Tags state ─────────────────────────────────────────────────────────────
  const [selectedTags,  setSelectedTags]  = useState<string[]>([]);
  const [allTags,       setAllTags]       = useState<string[]>([]);
  const [tagsLoading,   setTagsLoading]   = useState(true);
  const [customInput,   setCustomInput]   = useState('');
  const [uploading,     setUploading]     = useState(false);

  // ── Auto-tag on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!photo) return;
    let cancelled = false;

    (async () => {
      setTagsLoading(true);
      try {
        const uri = photo.bgRemovedUri ?? photo.rawUri;
        const result = await tagClothingItemStructured(uri, photo.category as 'top' | 'bottom' | 'shoes');
        if (cancelled) return;
        // Exactly 3 tags: [type, style, colour]
        const flat = flattenTags(result);
        setAllTags(flat);
        // Pre-select only the first tag (type), matching Figma design
        setSelectedTags([flat[0]]);
      } catch (err) {
        if (cancelled) return;
        console.warn('[clothing-detail] auto-tag failed, using fallback:', err);
        const fallback = FALLBACK_TAGS[photo.category] ?? FALLBACK_TAGS.top;
        setAllTags(fallback);
        setSelectedTags([fallback[0]]);
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [photo?.id]);  // run once per photo

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleAddCustomTag = useCallback(() => {
    const trimmed = customInput.trim().toUpperCase();
    if (!trimmed) return;
    setSelectedTags((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setCustomInput('');
  }, [customInput]);

  // ── Retake ─────────────────────────────────────────────────────────────────
  const handleRetake = useCallback(() => {
    if (!photo) return;
    if (photo.addedToCloset) removeItem(photo.id);
    retakePhoto(photo.id);
    // Pop 2 screens: clothing-detail → photo-confirm → camera-scan
    router.dismiss(2);
  }, [photo, removeItem, retakePhoto]);

  // ── Update closet ──────────────────────────────────────────────────────────
  // Uploads the photo to Supabase Storage, inserts a clothing_items row,
  // then adds the item to the local Zustand store with the public URL + DB id.
  const handleUpdateCloset = useCallback(async () => {
    if (!photo || uploading) return;

    const localUri = photo.bgRemovedUri ?? photo.rawUri;

    // Get the current user's id
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      Alert.alert('Not signed in', 'Please sign in to save your closet.');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload image to Supabase Storage
      const { publicUrl, storagePath } = await uploadClothingPhoto(
        localUri,
        session.user.id,
      );

      // 2. Insert DB record — returns the Supabase-generated UUID
      const dbId = await saveClothingItem({
        userId:      session.user.id,
        imageUrl:    publicUrl,
        storagePath,
        category:    photo.category,
        tags:        selectedTags,
      });

      // 3. Add to local store using cloud ID + public URL
      addItem({
        id:          dbId,
        imageUrl:    publicUrl,
        storagePath,
        category:    photo.category,
        tags:        selectedTags,
        createdAt:   new Date().toISOString(),
      });

      confirmToCloset(photo.id);
      router.back(); // back to photo-confirm
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  }, [photo, uploading, selectedTags, addItem, confirmToCloset]);

  // ── Item label — "TOP#1", "BOTTOM#2" etc. ─────────────────────────────────
  const itemLabel = (() => {
    if (!photo) return '';
    const sameCategory = photos.filter((p) => p.category === photo.category);
    const idx = sameCategory.findIndex((p) => p.id === photo.id) + 1;
    const labelMap: Record<ScanCategory, string> = {
      top:    'TOP',
      bottom: 'BOTTOM',
      shoes:  'SHOES',
    };
    return `${labelMap[photo.category]}#${idx}`;
  })();

  // ── Figma layout values ────────────────────────────────────────────────────
  const gradTop    = sy(46);
  const gradH      = sy(686);
  const photoLeft  = sx(42);
  const photoTop   = sy(111);
  const photoSize  = sx(309);
  // Figma: left:calc(33.33%+40px) ≈ 171px on 393 reference
  const labelLeft  = sw * 0.3333 + 40;
  const labelTop   = sy(124);
  const retakeTop  = sy(62) + insets.top;
  const retakeLeft = sx(284);
  const backTop    = sy(73) + insets.top;
  const backLeft   = sx(20);
  const tagsTop    = sy(438);
  const inputTop   = sy(586);
  const btnTop     = sy(660);
  const btnLeft    = (sw - sx(211)) / 2;

  if (!photo) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={s.errorMsg}>Photo not found</Text>
        <Pressable onPress={() => router.back()} style={s.emptyBtn}>
          <Text style={s.emptyBtnText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const photoUri = photo.bgRemovedUri ?? photo.rawUri;

  return (
    <View style={s.root}>

      {/* ── Gradient overlay: transparent (top:46) → surface-100 (bottom) ── */}
      {/* Figma 144:233: from surface-100 bottom to transparent top */}
      <LinearGradient
        colors={['rgba(245,244,244,0)', 'rgba(245,244,244,0.44)', Colors.surface[100]]}
        locations={[0, 0.245, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[s.gradient, { top: gradTop, height: gradH }]}
        pointerEvents="none"
      />

      {/* ── Photo (Figma 144:234: left:42, top:111, size:309) ─────────────── */}
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={[s.photo, { left: photoLeft, top: photoTop, width: photoSize, height: photoSize }]}
          resizeMode="contain"
        />
      ) : (
        <View style={[s.photoPlaceholder, { left: photoLeft, top: photoTop, width: photoSize, height: photoSize }]} />
      )}

      {/* ── Back chevron (Figma inset: 8.58% top, 5.09% left ≈ top:73,left:20) */}
      <Pressable
        style={[s.backBtn, { top: backTop, left: backLeft }]}
        onPress={() => router.back()}
        hitSlop={16}
        accessibilityLabel="Back to recent photos"
      >
        <Ionicons name="chevron-down" size={18} color={Colors.surface[200]} />
      </Pressable>

      {/* ── "RETAKE PHOTO" text (Figma 453:38: top:62, right-ish) ────────── */}
      <Pressable
        style={[s.retakeBtn, { top: retakeTop, left: retakeLeft }]}
        onPress={handleRetake}
        hitSlop={12}
      >
        <Text style={s.retakeText}>RETAKE PHOTO</Text>
      </Pressable>

      {/* ── Item label "TOP#1" + edit icon (Figma 144:255, 563:162) ─────────── */}
      <View style={[s.labelRow, { top: labelTop + insets.top, left: labelLeft }]}>
        <Text style={s.itemLabel}>{itemLabel}</Text>
        <Ionicons name="create-outline" size={13} color={Colors.surface[150]} />
      </View>

      {/* ── Tags + Input + Button ────────────────────────────────────────── */}
      <View style={[s.tagsSection, { top: tagsTop, left: sx(21), width: sx(314) }]}>

        {/* "SUGGESTED TAGS" row */}
        <View style={s.tagsSectionHeader}>
          <Ionicons name="add" size={10} color={Colors.surface[200]} />
          <Text style={s.tagsSectionLabel}>SUGGESTED TAGS</Text>
        </View>

        {/* Tag pills */}
        {tagsLoading ? (
          <View style={s.tagsLoadingRow}>
            <ActivityIndicator size="small" color={Colors.surface[150]} />
            <Text style={s.tagsLoadingText}>ANALYSING...</Text>
          </View>
        ) : (
          <View style={s.tagsList}>
            {/* AI-suggested tags (toggleable) */}
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  style={[s.tagPill, active && s.tagPillActive]}
                  onPress={() => toggleTag(tag)}
                  hitSlop={6}
                >
                  <Text style={[s.tagText, active && s.tagTextActive]}>{tag}</Text>
                </Pressable>
              );
            })}
            {/* Custom tags added by user (not in AI suggestions) */}
            {selectedTags
              .filter((t) => !allTags.includes(t))
              .map((tag) => (
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

      {/* ── "ADD TAGS..." input (Figma 144:252: top:586, left:20, w:353) ─── */}
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

      {/* ── "UPDATE CLOSET" button (Figma 144:256: top:660, centred, w:211) */}
      <Pressable
        style={[s.updateBtn, { top: btnTop, left: btnLeft, width: sx(211) }, uploading && s.updateBtnLoading]}
        onPress={handleUpdateCloset}
        disabled={uploading}
        accessibilityLabel="Update closet"
      >
        {uploading ? (
          <ActivityIndicator size="small" color={Colors.surface[100]} />
        ) : (
          <Text style={s.updateBtnText}>UPDATE CLOSET</Text>
        )}
      </Pressable>

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface[100] },

  // Gradient overlay
  gradient: {
    position: 'absolute',
    left:     0,
    right:    0,
    zIndex:   1,
  },

  // Photo
  photo: {
    position: 'absolute',
    zIndex:   2,
  },
  photoPlaceholder: {
    position:        'absolute',
    backgroundColor: Colors.surface[20],
    zIndex:          2,
  },

  // Back chevron
  backBtn: {
    position: 'absolute',
    zIndex:   10,
  },

  // Retake text link (top-right)
  retakeBtn: {
    position: 'absolute',
    zIndex:   10,
  },
  retakeText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // Item label row: "TOP#1 ✏" — absolutely positioned, flex row
  labelRow: {
    position:      'absolute',
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    zIndex:        10,
  },
  itemLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
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
  tagsLoadingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  tagsLoadingText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           11,
    alignItems:    'center',
  },
  tagPill: {
    height:            24,
    paddingHorizontal: 14,
    paddingVertical:   4,
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

  // Error / empty states
  errorMsg: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    letterSpacing: -0.28,
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
