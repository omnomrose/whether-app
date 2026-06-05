// Design system — typography tokens
// Fonts: Hedvig Letters Serif (heading) + Public Sans (UI)
// Install: npx expo install @expo-google-fonts/hedvig-letters-serif @expo-google-fonts/public-sans expo-font
// Load in app/_layout.tsx via useFonts (see that file)

import { TextStyle } from 'react-native';

export const FontFamily = {
  serif: 'HedvigLettersSerif_400Regular',
  sans: 'PublicSans_400Regular',
  sansMedium: 'PublicSans_500Medium',
  sansBold: 'PublicSans_700Bold',
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

  // Public Sans — body
  bodyXl: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.36,
  } satisfies TextStyle,

  bodyLg: {
    fontFamily: FontFamily.sans,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.36,
  } satisfies TextStyle,

  bodyMd: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.32,
  } satisfies TextStyle,

  bodySm: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.28,
  } satisfies TextStyle,

  // Public Sans Regular — labels/captions (UPPERCASE)
  caption: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: -0.18,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;
