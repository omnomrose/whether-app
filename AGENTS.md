# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

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

- React Native (Expo v56) — mobile framework, iOS first
- Expo Router — file-based navigation
- NativeWind v4 — Tailwind styling for React Native
- Zustand — state management (weatherStore, closetStore, outfitStore)
- Supabase — database + authentication + image storage
- PhotoRoom API — AI background removal (sandbox = free + watermarked for dev; swap to production key for release). Fallback: Rembg (open source)
- OpenWeatherMap — weather temperature + feels-like data (free tier, non-commercial)
- Claude API (claude-sonnet-4-6) — outfit recommendations + clothing auto-tagging via vision
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
  weather.ts               # OpenWeatherMap fetch helpers
  photoroom.ts             # Background removal API
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
- `EXPO_PUBLIC_OPENWEATHER_API_KEY`
- `EXPO_PUBLIC_PHOTOROOM_API_KEY`
- `EXPO_PUBLIC_CLAUDE_API_KEY`

## RULES/NON-NEGOTIABLES

- Stick to the design system. If there are any design decisions, ask first.
- Ask before making changes.
- All env vars use `EXPO_PUBLIC_` prefix (required for Expo to expose to client).
- Never commit `.env` to git.
- PhotoRoom sandbox mode is fine for development (watermarked output). Switch to production API key before user-facing release.

## MVP SCOPE

Outfit recommendations based on real-time weather + digitalized closet. Week-ahead planning is post-MVP.
