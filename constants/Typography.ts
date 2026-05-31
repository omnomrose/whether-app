// Design system — typography tokens
// Font: Work Sans (load via @expo-google-fonts/work-sans or assets/fonts/)
// All text is lowercase by default except title-lg (uppercase)

import { TextStyle } from 'react-native';

// TODO: Load Work Sans — add to root _layout.tsx:
//   import { useFonts } from 'expo-font';
//   or: yarn add @expo-google-fonts/work-sans

export const FontFamily = {
  regular: 'WorkSans_400Regular',  // fallback: undefined (system)
  bold: 'WorkSans_700Bold',        // fallback: undefined (system)
} as const;

export const Typography = {
  titleLg: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.48,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  bodyXl: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '500',
    textTransform: 'lowercase',
  } satisfies TextStyle,

  bodyLg: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '400',
    textTransform: 'lowercase',
  } satisfies TextStyle,

  bodyMd: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    textTransform: 'lowercase',
  } satisfies TextStyle,

  bodySm: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    textTransform: 'lowercase',
  } satisfies TextStyle,

  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    textTransform: 'lowercase',
  } satisfies TextStyle,
} as const;
