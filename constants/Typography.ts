// Design system — typography tokens
// Fonts: Hedvig Letters Serif (heading) + DM Mono (UI)
// Install: npx expo install @expo-google-fonts/hedvig-letters-serif @expo-google-fonts/dm-mono expo-font
// Load in app/_layout.tsx via useFonts (see that file)

import { TextStyle } from 'react-native';

export const FontFamily = {
  serif:      'HedvigLettersSerif_400Regular',
  sans:       'DMMono_400Regular',
  sansMedium: 'DMMono_500Medium',
  sansBold:   'DMMono_500Medium',   // DM Mono has no 700; use 500 as heaviest
  dmSans:     'DMSans_400Regular',  // large numeric displays (weather temp)
} as const;

export const Typography = {
  // Hedvig Letters Serif — headings
  titleLg: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: -1.2,
  } satisfies TextStyle,

  // DM Mono — body
  bodyXl: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.9,  // -5% of 18
  } satisfies TextStyle,

  bodyLg: {
    fontFamily: FontFamily.sans,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.9,  // -5% of 18
  } satisfies TextStyle,

  bodyMd: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.8,  // -5% of 16
  } satisfies TextStyle,

  bodySm: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.7,  // -5% of 14
  } satisfies TextStyle,

  // DM Mono Regular — labels/captions (UPPERCASE)
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: -0.6,  // -5% of 12
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;
