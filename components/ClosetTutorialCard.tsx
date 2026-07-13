/**
 * ClosetTutorialCard — Figma node 327:111 "Tutorial Card"
 *
 * Shown when the user taps the closet button on the location-set screen.
 * Morphs in from the closet button via a spring animation managed by the parent.
 *
 * Annotation: "ask if it's ok to use camera" → onConfirm triggers camera permission.
 *
 * Photo slots are empty placeholders; the user will supply real images later.
 */

import { View, Text, ScrollView, Pressable, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';

// ─── Example photos (Figma 144:68 do/don't guide) ─────────────────────────────
const TUTORIAL_IMAGES = {
  topsDo:    require('@/assets/images/tutorial/tops-do.jpg'),
  topsDont:  require('@/assets/images/tutorial/tops-dont.jpg'),
  shoesDo:   require('@/assets/images/tutorial/shoes-do.jpg'),
  shoesDont: require('@/assets/images/tutorial/shoes-dont.jpg'),
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Do/don't example photo — fills the design's 144px slot. */
function PhotoSlot({ source }: { source?: ImageSourcePropType }) {
  if (!source) return <View style={s.photoSlot} />;
  return <Image source={source} style={s.photoSlot} resizeMode="cover" />;
}

type ExampleSectionProps = {
  title: string;
  /** Caption shown above the DO photo (thumbs-up side) */
  doLabel: string;
  /** Caption shown above the DON'T photo (thumbs-down side) */
  dontLabel: string;
  doImage?:   ImageSourcePropType;
  dontImage?: ImageSourcePropType;
};

/** One guide section (e.g. "Tops & Bottoms") with a do/don't photo pair. */
function ExampleSection({ title, doLabel, dontLabel, doImage, dontImage }: ExampleSectionProps) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>

      <View style={s.columnsRow}>
        {/* ✓ DO column */}
        <View style={s.column}>
          <View style={s.columnHeader}>
            <Text style={s.columnLabel}>{doLabel}</Text>
            <View style={s.thumbWrap}>
              <Ionicons name="thumbs-up" size={20} color={Colors.surface[200]} />
            </View>
          </View>
          <PhotoSlot source={doImage} />
        </View>

        {/* ✗ DON'T column */}
        <View style={s.column}>
          <View style={s.columnHeader}>
            <Text style={s.columnLabel}>{dontLabel}</Text>
            <View style={s.thumbWrap}>
              <Ionicons name="thumbs-down" size={20} color={Colors.surface[200]} />
            </View>
          </View>
          <PhotoSlot source={dontImage} />
        </View>
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Called when the user taps "OKAY, GOT IT" — parent requests camera permission then navigates. */
  onConfirm: () => void;
}

export default function ClosetTutorialCard({ onConfirm }: Props) {
  return (
    // Solid surface-100 card (glass UI removed from the design system)
    <View style={s.card}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={s.scrollContent}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        {/* Figma 321:63 — title + subtitle, gap 8 */}
        <View style={s.header}>
          <Text style={s.title}>Let's build your digital closet</Text>
          <Text style={s.subtitle}>(SO WE CAN RECOMMEND FITS YOU ACTUALLY OWN!)</Text>
        </View>

        {/* ── Photo guide ──────────────────────────────────────── */}
        {/* Figma 321:105 — two sections, gap 20 */}
        <View style={s.sections}>
          <ExampleSection
            title="Tops & Bottoms"
            doLabel={'CLEAR, FLAT,\nFRONT & BACK'}
            dontLabel={'MANNEQUINS\n& HANGERS'}
            doImage={TUTORIAL_IMAGES.topsDo}
            dontImage={TUTORIAL_IMAGES.topsDont}
          />
          <ExampleSection
            title="Shoes"
            doLabel={'CLEAR SIDE\nVIEW'}
            dontLabel={"BIRD EYE'S\nVIEW"}
            doImage={TUTORIAL_IMAGES.shoesDo}
            dontImage={TUTORIAL_IMAGES.shoesDont}
          />
        </View>

        {/* ── CTA — Figma 144:84, primary-100 bg, radius 50 ────── */}
        <Pressable style={s.ctaBtn} onPress={onConfirm}>
          <Text style={s.ctaText}>OKAY, GOT IT</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// All dimensions from Figma node 327:111 (393 × 852 frame).

const s = StyleSheet.create({
  // Solid surface-100 card — radius 32 (glass UI removed)
  card: {
    flex:            1,
    borderRadius:    32,
    borderWidth:     1,
    borderColor:     Colors.surface[100],
    backgroundColor: Colors.surface[100],
    overflow:        'hidden',
  },

  // ScrollView content — padding 24, gap 44 between header/sections/button
  scrollContent: {
    padding:  24,
    gap:      44,
    flexGrow: 1,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: { gap: 8 },

  title: {
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         Colors.surface[200],
  },
  subtitle: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    textAlign:     'center',
    color:         Colors.surface[200],
  },

  // ── Sections container ────────────────────────────────────────────────────
  // Figma 321:105 — gap 20 between Tops&Bottoms and Shoes
  sections: { gap: 20 },

  // Each section: sectionTitle + columnsRow, gap 16
  section: { gap: 16 },

  sectionTitle: {
    fontFamily:    FontFamily.serif,
    fontSize:      18,
    lineHeight:    22,
    letterSpacing: -0.9,
    color:         Colors.surface[200],
  },

  // Two-column row — Figma gap 15
  columnsRow: {
    flexDirection: 'row',
    gap:           15,
  },

  // Each column — flex:1 so they share the space, gap 12 between header and photo
  column: {
    flex: 1,
    gap:  12,
  },

  // Column header: label + thumbs icon, spaced apart
  // Figma: gap 32 between label (85px) and icon (28px)
  columnHeader: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
  },

  columnLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
    flex:          1,
  },

  thumbWrap: {
    width:       28,
    height:      28,
    alignItems:  'center',
    justifyContent: 'center',
    flexShrink:  0,
  },

  // Do/don't photo — Figma: h:144, radius 6 (grey fill shows while loading /
  // if a source is missing)
  photoSlot: {
    width:           '100%',
    height:          144,
    backgroundColor: 'rgba(91,90,90,0.30)',
    borderRadius:    6,
    overflow:        'hidden',
  },

  // ── CTA button — Figma 144:84 ─────────────────────────────────────────────
  // primary-100 (#b3ccf0), radius 50, px:24 py:8, shadow-card
  ctaBtn: {
    alignSelf:         'center',
    backgroundColor:   Colors.primary[100],
    paddingHorizontal: 24,
    paddingVertical:   8,
    borderRadius:      50,
    shadowColor:       '#1d1d1d',
    shadowOffset:      { width: 0, height: 13 },
    shadowOpacity:     0.05,
    shadowRadius:      14,
    elevation:         4,
  },

  ctaText: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
});
