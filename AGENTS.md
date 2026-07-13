# Expo HAS CHANGED

The project runs **Expo SDK 54** (downgraded from 56 for Expo Go compatibility).
Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

---

## PROJECT OVERVIEW

A weather combined outfit picker app that helps people dress accordingly. Whether starts by asking what location/city they're from, builds a base closet via user-taken pictures of their clothes, and how long/what they'll be doing for the day.

### KEY FLOWS

Weather: User opens whether, whether asks for location/city

Digitalizing Closet: whether asks user to take pictures of their clothes (Ex. To start, take pics of 3 tops, 2 bottoms, accessories, shoes)

Personalization: whether asks what the user's plans are for the day (what they'll be doing, how long you'll be out, etc), then recommends outfits based on the weather and the user's digitalized closet

Planning: whether gives the user to outfit-prep a week in advance. (POST-MVP)

### KEY FEATURES

Weather: Grabs specific temperatures for every hour, what the weather feels like

Remove BG feature: The ability to take a picture of a specific piece of clothing and remove the background

Digital Closet: Sorts through articles of clothes, organizes it into categories (fabric, type of clothing), outfit suggestions.

## TARGET USER

People who have a hard time deciding what to wear for the day. This is meant for Gen-Z/Millenials who usually leave things last minute. They want guidance and personalization, and to feel in control of their outfit choices with these recommendations.

## TECH STACK

- React Native (Expo SDK 54) — mobile framework, iOS first
- Expo Router — file-based navigation
- NativeWind v4 — Tailwind styling for React Native
- Zustand — state management (weatherStore, closetStore, outfitStore)
- Supabase — database + authentication + image storage
- Cloudinary — AI background removal (unsigned upload preset + `e_background_removal` delivery effect; async — poll until 423 clears). Fallback: withoutBG API (legacy, credits nearly exhausted)
- Open-Meteo — weather temperature + feels-like + wind data (free, no API key required — https://open-meteo.com)
- Claude API (claude-sonnet-5) — outfit recommendations + clothing auto-tagging via vision. NOTE: "claude-sonnet-4-6" is NOT a valid model ID — it 404s every call.
- Expo Camera + Expo Image Picker — native camera access for closet scanning

## PROJECT STRUCTURE

```
app/
  _layout.tsx              # Root layout, imports global.css
  index.tsx                # Entry redirect (onboarding vs tabs)
  (onboarding)/
    _layout.tsx
    welcome.tsx            # Welcome + location permission
    location.tsx           # City input
    closet-setup.tsx       # Initial closet photo prompts
  (tabs)/
    _layout.tsx
    index.tsx              # Today — weather + outfit recommendation
    closet.tsx             # Digital closet browser
    outfit.tsx             # Outfit suggestions + day plans input

store/
  weatherStore.ts          # location, weather data
  closetStore.ts           # clothing items + tags
  outfitStore.ts           # day plans, suggestions, loading state

lib/
  supabase.ts              # Supabase client
  weather.ts               # Open-Meteo fetch helpers (geocode + current + hourly)
  photoroom.ts             # Background removal entry point (Cloudinary primary, withoutBG fallback)
  cloudinary.ts            # Cloudinary unsigned upload + e_background_removal
  claude.ts                # Clothing tagging + outfit suggestion prompts

components/                # Shared UI components (to be created per design)
constants/                 # Colors, spacing, fonts (to be created per design system)
assets/                    # Icons, images, splash

.env.example               # All required env vars (copy to .env, never commit)
```

## ENVIRONMENT VARIABLES

See `.env.example` for all required keys:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `EXPO_PUBLIC_WITHOUTBG_API_KEY` (fallback)
- `EXPO_PUBLIC_CLAUDE_API_KEY`

## RULES/NON-NEGOTIABLES

- Stick to the design system. If there are any design decisions, ask first.
- Ask before making changes.
- All env vars use `EXPO_PUBLIC_` prefix (required for Expo to expose to client).
- Never commit `.env` to git.
- Cloudinary API secret must NEVER be in the app or `.env` with `EXPO_PUBLIC_` prefix — the unsigned upload preset is the only client-side credential.

## PACKAGE MANAGEMENT — NON-NEGOTIABLE

All packages must be compatible with **Expo SDK 54**. Wrong versions break the build silently or with cryptic errors.

### Pinned versions (must match exactly)

| Package | Required version |
|---|---|
| `react-native-reanimated` | `~4.1.1` |
| `react-native-webview` | `13.15.0` |
| `react-native-worklets` | `0.5.1` |
| `react-native-screens` | `~4.16.0` |
| `react-native-safe-area-context` | `~5.6.0` |
| `expo-router` | `~6.0.24` |
| `expo-font` | `~14.0.12` |
| `expo-camera` | `~17.0.10` |
| `expo-image` | `~3.0.11` |
| `expo-image-picker` | `~17.0.11` |
| `expo-location` | `~19.0.8` |
| `expo-splash-screen` | `~31.0.13` |
| `expo-status-bar` | `~3.0.9` |
| `expo-constants` | `~18.0.13` |
| `expo-linking` | `~8.0.12` |
| `@react-native-async-storage/async-storage` | `2.2.0` |
| `react-native` | `0.81.5` |
| `react` | `19.1.0` |

### Known version traps
- **`react-native-reanimated`**: Must be `~4.1.1` AND paired with `react-native-worklets@0.5.1`. Both are required — reanimated 4.x imports worklets as a peer. Installing reanimated without worklets gives `Unable to resolve "react-native-worklets"`. Installing 3.16.x gives `Cannot find module 'react-native-worklets/plugin'`. Neither 3.x version works.
- **`react-native-worklets`**: Always install alongside reanimated. SDK 54 expects `0.5.1`.

### Install rules
```bash
# Always use one of these — never plain npm install
npx expo install <package>
npm install <package> --legacy-peer-deps
```

After any install, check for drift:
```bash
npx expo install --check
# If mismatches found:
npx expo install --fix --legacy-peer-deps
```

## MVP SCOPE

Outfit recommendations based on real-time weather + digitalized closet. Week-ahead planning is post-MVP.
