// Design system — colour tokens
// Source: whether Figma (variables/colours)

export const Colors = {
  surface: {
    10:  'rgba(43,30,30,0.1)', // subtle border
    20:  '#d4d4d4',
    30:  '#5b5a5a',            // dim text — unmatched search results
    100: '#f5f4f4',
    150: '#786c6c',            // muted brownish-gray
    200: '#2b1e1e',            // near-black
  },
  primary: {
    10: 'transparent',
    100: '#b3ccf0',
    200: '#6b9fd4',
    300: '#3b82f6',
  },
  danger: {
    30: '#fca5a5',
    50: '#f87171',
    100: '#ef4444',
    200: '#dc2626',
  },
  warning: {
    30: '#fef9c3',
    50: '#fef08a',
    100: '#ca8a04',
    200: '#a16207',
  },
  success: {
    30: '#dcfce7',
    50: '#86efac',
    100: '#22c55e',
    200: '#16a34a',
  },
  text: {
    primary: '#2b1e1e',
    muted: '#5b5a5a',
  },
  // Gradient tokens — pass directly to expo-linear-gradient
  // Source: Figma variable "linear-clear-sky" (node 144:63)
  gradient: {
    clearSky: {
      colors: ['#78c3f1', '#b4dbf2', '#f5f4f4'] as ['#78c3f1', '#b4dbf2', '#f5f4f4'],
      locations: [0, 0.702, 1] as [number, number, number],
    },
  },
} as const;
