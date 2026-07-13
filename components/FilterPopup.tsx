// Figma node 600:98 — "filter-popup-tops"
// Shown as a centred modal overlay when user taps FILTER in closet-category.
//
// Sections:
//   TYPE    — pill chips, options vary per category
//   STYLE   — pill chips, shared across all categories
//   COLOUR  — 25px circle swatches, 10 colours
//   Footer  — RESET FILTERS (outlined) + APPLY FILTERS (filled)
//
// Selected pill:  bg surface-200 (#262222), text surface-100 (#f5f4f4)
// Selected swatch: 2.5px border surface-200
// Unselected pill: border rgba(38,34,34,0.3), text surface-150 (#786c6c)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FilterState = {
  types:   string[];
  styles:  string[];
  colours: string[];
};

export const EMPTY_FILTERS: FilterState = { types: [], styles: [], colours: [] };

interface FilterPopupProps {
  visible:        boolean;
  category:       'top' | 'bottom' | 'shoes';
  initialFilters?: FilterState;
  onApply:        (filters: FilterState) => void;
  onClose:        () => void;
}

// ─── Data — mirrors TYPE_OPTIONS / STYLE_OPTIONS / COLOUR_OPTIONS in lib/claude.ts ──

const TYPE_OPTIONS: Record<string, string[]> = {
  top:    ['T-SHIRT', 'TANK', 'BUTTON-DOWN', 'CARDIGAN', 'CORSET', 'PEPLUM', 'VEST', 'BLOUSE'],
  bottom: ['JEANS', 'TROUSERS', 'SHORTS', 'SKIRT', 'LEGGINGS'],
  shoes:  ['SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'LOAFERS', 'FLATS'],
};

const STYLE_OPTIONS = [
  'CUTE', 'NOSTALGIC', 'COOL', 'CLASSIC', 'BOLD', 'CASUAL', 'COMFY', 'ELEGANT',
];

// Matches COLOUR_OPTIONS in lib/claude.ts
const COLOUR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'RED',        hex: '#EF4444' },
  { label: 'ORANGE',     hex: '#F97316' },
  { label: 'YELLOW',     hex: '#EAB308' },
  { label: 'GREEN',      hex: '#22C55E' },
  { label: 'LIGHT BLUE', hex: '#60A5FA' },
  { label: 'PURPLE',     hex: '#A855F7' },
  { label: 'PINK',       hex: '#EC4899' },
  { label: 'BLACK',      hex: '#1C1C1E' },
  { label: 'GRAY',       hex: '#8E8E93' },
  { label: 'WHITE',      hex: '#FFFFFF' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FilterPopup({
  visible,
  category,
  initialFilters = EMPTY_FILTERS,
  onApply,
  onClose,
}: FilterPopupProps) {
  const [local, setLocal] = useState<FilterState>(initialFilters);
  const types = TYPE_OPTIONS[category] ?? TYPE_OPTIONS.top;

  // Sync local state each time the popup opens
  useEffect(() => {
    if (visible) setLocal(initialFilters);
  }, [visible]);

  const handleApply = () => {
    onApply(local);
    onClose();
  };

  const handleReset = () => {
    const cleared = EMPTY_FILTERS;
    setLocal(cleared);
    onApply(cleared);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ── Dark backdrop — tap outside to dismiss ──────────────────────── */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop}>

          {/* Swallow touches inside the card so they don't close the modal */}
          <TouchableWithoutFeedback>
            <View style={s.card}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={s.scroll}
              >

                {/* ── FILTER BY heading ─────────────────────────────────── */}
                <Text style={s.heading}>Filter by</Text>

                {/* ── TYPE ──────────────────────────────────────────────── */}
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Type</Text>
                  <View style={s.pills}>
                    {types.map((t) => {
                      const sel = local.types.includes(t);
                      return (
                        <Pressable
                          key={t}
                          style={[s.pill, sel && s.pillSelected]}
                          onPress={() =>
                            setLocal((prev) => ({ ...prev, types: toggle(prev.types, t) }))
                          }
                          hitSlop={4}
                        >
                          <Text style={[s.pillText, sel && s.pillTextSelected]}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ── STYLE ─────────────────────────────────────────────── */}
                <View style={s.section}>
                  <Text style={s.sectionLabel}>Style</Text>
                  <View style={s.pills}>
                    {STYLE_OPTIONS.map((style) => {
                      const sel = local.styles.includes(style);
                      return (
                        <Pressable
                          key={style}
                          style={[s.pill, sel && s.pillSelected]}
                          onPress={() =>
                            setLocal((prev) => ({ ...prev, styles: toggle(prev.styles, style) }))
                          }
                          hitSlop={4}
                        >
                          <Text style={[s.pillText, sel && s.pillTextSelected]}>{style}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ── COLOUR ────────────────────────────────────────────── */}
                <View style={[s.section, { marginBottom: 0 }]}>
                  <Text style={s.sectionLabel}>Colour</Text>
                  <View style={s.swatches}>
                    {COLOUR_SWATCHES.map(({ label, hex }) => {
                      const sel = local.colours.includes(label);
                      return (
                        <Pressable
                          key={label}
                          onPress={() =>
                            setLocal((prev) => ({ ...prev, colours: toggle(prev.colours, label) }))
                          }
                          hitSlop={6}
                        >
                          <View
                            style={[
                              s.swatch,
                              { backgroundColor: hex },
                              label === 'WHITE' && s.swatchWhiteBorder,
                              sel && s.swatchSelected,
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

              </ScrollView>

              {/* ── Footer ────────────────────────────────────────────── */}
              <View style={s.footer}>
                <Pressable style={s.resetBtn} onPress={handleReset} hitSlop={6}>
                  <Text style={s.resetText}>Reset filters</Text>
                </Pressable>
                <Pressable style={s.applyBtn} onPress={handleApply} hitSlop={6}>
                  <Text style={s.applyText}>Apply filters</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>

        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  // ── Overlay ─────────────────────────────────────────────────────────────
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent:  'center',
    alignItems:      'center',
    paddingHorizontal: 24,
  },

  // ── Card — Figma: bg surface-100, radius 8, shadow-card ─────────────────
  card: {
    width:           '100%',
    backgroundColor: Colors.surface[100],
    borderRadius:    8,
    paddingHorizontal: 18,
    paddingTop:      23,
    paddingBottom:   20,
    maxHeight:       '88%',
    // shadow-card (Figma)
    shadowColor:   '#1D1D1D',
    shadowOffset:  { width: 0, height: 13 },
    shadowOpacity: 0.05,
    shadowRadius:  14,
    elevation:     8,
  },

  scroll: {
    paddingBottom: 4,
  },

  // ── Heading — body-md, surface-200, uppercase ────────────────────────────
  heading: {
    fontFamily:    FontFamily.sans,
    fontSize:      16,
    lineHeight:    20,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    marginBottom:  24,
  },

  // ── Section ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    marginBottom:  12,
  },

  // ── Pills (type + style) ─────────────────────────────────────────────────
  pills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  pill: {
    borderWidth:       1,
    borderColor:       'rgba(38,34,34,0.3)',
    borderRadius:      4,
    paddingHorizontal: 16,
    paddingVertical:   4,
  },
  pillSelected: {
    backgroundColor: Colors.surface[200],
    borderColor:     Colors.surface[200],
  },
  pillText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  pillTextSelected: {
    color: Colors.surface[100],
  },

  // ── Colour swatches — 25px circles, 7-per-row wrapping ──────────────────
  swatches: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           12,
  },
  swatch: {
    width:        25,
    height:       25,
    borderRadius: 13,
  },
  // White needs a subtle border so it's visible against the card bg
  swatchWhiteBorder: {
    borderWidth: 1,
    borderColor: 'rgba(38,34,34,0.2)',
  },
  // Selected: prominent surface-200 ring
  swatchSelected: {
    borderWidth: 2.5,
    borderColor: Colors.surface[200],
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      28,
  },
  resetBtn: {
    borderWidth:       1,
    borderColor:       Colors.surface[150],
    borderRadius:      4,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  resetText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
  applyBtn: {
    backgroundColor: Colors.surface[200],
    borderRadius:    4,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  applyText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[100],
  },
});
