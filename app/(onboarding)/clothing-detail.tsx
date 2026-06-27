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

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
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

// ─── Figma frame reference ─────────────────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Suggested tags per category ──────────────────────────────────────────────
const SUGGESTED_TAGS: Record<ScanCategory, string[]> = {
  top:    ['CASUAL', 'EVERYDAY', 'LAYERING'],
  bottom: ['DENIM', 'CASUAL', 'EVERYDAY'],
  shoes:  ['SNEAKERS', 'CASUAL', 'COMFORTABLE'],
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
  const suggestedTags  = photo ? SUGGESTED_TAGS[photo.category] : [];
  const [selectedTags, setSelectedTags] = useState<string[]>([suggestedTags[0] ?? ''].filter(Boolean));
  const [customInput,  setCustomInput]  = useState('');

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
  const handleUpdateCloset = useCallback(() => {
    if (!photo) return;
    const imageUrl = photo.bgRemovedUri ?? photo.rawUri;
    addItem({
      id:        photo.id,
      imageUrl,
      category:  photo.category,
      tags:      selectedTags,
      createdAt: new Date().toISOString(),
    });
    confirmToCloset(photo.id);
    router.back();  // back to photo-confirm
  }, [photo, selectedTags, addItem, confirmToCloset]);

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
  const labelLeft  = sx(151);
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

      {/* ── Item label "TOP#1" (Figma 144:255: top:124, left≈151) ─────────── */}
      <Text style={[s.itemLabel, { top: labelTop, left: labelLeft }]}>
        {itemLabel}
      </Text>

      {/* ── Tags + Input + Button ────────────────────────────────────────── */}
      <View style={[s.tagsSection, { top: tagsTop, left: sx(21), width: sx(314) }]}>

        {/* "SUGGESTED TAGS" row */}
        <View style={s.tagsSectionHeader}>
          <Ionicons name="add" size={10} color={Colors.surface[200]} />
          <Text style={s.tagsSectionLabel}>SUGGESTED TAGS</Text>
        </View>

        {/* Tag pills */}
        <View style={s.tagsList}>
          {suggestedTags.map((tag) => {
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
          {/* Custom tags added by user */}
          {selectedTags
            .filter((t) => !suggestedTags.includes(t))
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
        style={[s.updateBtn, { top: btnTop, left: btnLeft, width: sx(211) }]}
        onPress={handleUpdateCloset}
        accessibilityLabel="Update closet"
      >
        <Text style={s.updateBtnText}>UPDATE CLOSET</Text>
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

  // Item label "TOP#1"
  itemLabel: {
    position:      'absolute',
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
    zIndex:        3,
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

  // UPDATE CLOSET button (dark pill)
  updateBtn: {
    position:          'absolute',
    height:            40,
    backgroundColor:   Colors.surface[200],
    borderRadius:      40,
    alignItems:        'center',
    justifyContent:    'center',
    zIndex:            5,
  },
  updateBtnText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[100],
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
