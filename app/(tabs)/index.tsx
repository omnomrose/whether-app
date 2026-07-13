// Figma node 424:239 — main home screen
//
// Layout (393 × 852 reference):
//   Sky gradient:          #1586cc → #b4dbf2 (full screen)
//   Location pill:         left:20, top:61
//   PFP circle:            left:calc(83.33%+5.5px)≈333px, top:56, size:34×35
//   Heading:               centred, w:231, top:108
//   Bottom white gradient: top:549, h:303
//   Outfit images (absolute, layered like a mannequin):
//     Top:    left:~113, top:169, w:168, h:229
//     Bottom: left:~110, top:283, w:173, h:236
//     Shoes:  left:~150, top:479, w:94,  h:65
//   Dressing pill:         left:20, top:566, w:231
//   Refresh + Closet btns: left:~265, top:566
//   Weather card:          left:20, top:622, w:353, h:149 (solid, radius 8)
//   NavBar:                floating bottom pill (NavBar)

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import WeatherIcon from '@/components/WeatherIcon';
import NavBar from '@/components/NavBar';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useWeatherStore, type HourlyItem } from '@/store/weatherStore';
import { useOutfitStore } from '@/store/outfitStore';
import { useClosetStore } from '@/store/closetStore';
import { fetchCurrentWeather, fetchHourlyForecast } from '@/lib/weather';
import { selectWeatherOutfit } from '@/lib/outfit';

// ─── Figma frame reference ─────────────────────────────────────────────────────
const FW = 393;
const FH = 852;

// ─── Feels-like caption ────────────────────────────────────────────────────────
function buildFeelsCaption(feelsLike: number, windKph: number): string {
  if (windKph > 25) return feelsLike > 18 ? 'warm but quite windy' : 'cold and very windy';
  if (windKph > 12) return feelsLike > 20 ? 'warm but a little breezy' : 'cool and breezy';
  if (feelsLike > 28) return 'hot — dress light';
  if (feelsLike > 22) return 'warm and comfortable';
  if (feelsLike > 15) return 'mild — a light layer works';
  if (feelsLike > 5)  return 'cool — bring a jacket';
  return 'cold — bundle up';
}

// ─── Hourly cell ───────────────────────────────────────────────────────────────
function HourCell({ item }: { item: HourlyItem }) {
  return (
    <View style={s.hourCell}>
      <WeatherIcon conditionCode={item.conditionCode} />
      <Text style={s.hourTime}>{item.time}</Text>
    </View>
  );
}

// ─── PFP circle ───────────────────────────────────────────────────────────────
function PfpCircle({ initial, avatarUrl }: { initial: string; avatarUrl: string | null }) {
  return (
    <View style={s.pfp}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={s.pfpImg} />
      ) : (
        <Text style={s.pfpInitial}>{initial}</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets              = useSafeAreaInsets();
  const { width: sw, height: sh } = useWindowDimensions();

  const sx = (x: number) => (x / FW) * sw;
  const sy = (y: number) => (y / FH) * sh;

  const { location, displayLocation, weather, lastFetched, setWeather, userName } =
    useWeatherStore();
  const { currentOutfit, setCurrentOutfit } = useOutfitStore();
  const { items: closetItems } = useClosetStore();

  const [refreshing,  setRefreshing]  = useState(false);
  const [outfitOffset, setOutfitOffset] = useState(0);
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);

  // ── Load avatar URL from Supabase session ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const meta = session?.user?.user_metadata ?? {};
      if (meta.avatar_url) setAvatarUrl(meta.avatar_url as string);
    });
  }, []);

  // ── Weather fetch — only if stale (> 30 min) or missing ──────────────────
  // Persisted weather is shown immediately — no loading state on fresh opens.
  useEffect(() => {
    if (!location) return;
    const ageMin = lastFetched ? (Date.now() - lastFetched) / 60_000 : Infinity;
    // Skip if cached and fresh
    if (weather && ageMin < 30) return;

    let cancelled = false;
    (async () => {
      try {
        const [current, hourly] = await Promise.all([
          fetchCurrentWeather(location),
          fetchHourlyForecast(location),
        ]);
        if (!cancelled) setWeather({ ...current, hourly });
      } catch {
        // Silently keep showing cached data
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // ── Outfit selection — recalculate when weather / closet / offset changes ─
  useEffect(() => {
    if (!weather || !closetItems.length) return;
    const outfit = selectWeatherOutfit(weather, closetItems, outfitOffset);
    setCurrentOutfit(outfit);
  }, [weather, closetItems, outfitOffset]);

  // ── Refresh outfit — Figma annotation 424:250: "change to refresh outfit btn"
  // Re-rolls the outfit combination only; weather refreshes itself when stale.
  const handleRefreshOutfit = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    setOutfitOffset((o) => o + 1);
    // Brief visual feedback window
    setTimeout(() => setRefreshing(false), 350);
  }, [refreshing]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const firstName = userName
    ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()
    : null;

  const heading = firstName
    ? `${firstName}, you'd look great\nin this`
    : `You'd look great\nin this`;

  const locationLabel = displayLocation
    ? displayLocation.split(', ').slice(0, 2).join(', ')
    : location?.toUpperCase() ?? '';

  const initial = firstName ? firstName.charAt(0).toUpperCase() : '?';

  // ── Figma positions ────────────────────────────────────────────────────────
  // Location pill: top:61 (+ safe area)
  const pillTop      = sy(61) + insets.top;
  // Heading: top:108
  const headingTop   = sy(108) + insets.top;
  // PFP: top:56, right:20
  const pfpTop       = sy(56) + insets.top;
  // Outfit images
  const topImgLeft   = sx(113);
  const topImgTop    = sy(169);
  const topImgW      = sx(168);
  const topImgH      = sy(229);
  const botImgLeft   = sx(110);
  const botImgTop    = sy(283);
  const botImgW      = sx(173);
  const botImgH      = sy(236);
  // Shoes must stay clearly visible — never smaller than 94×60pt
  const shoesW       = Math.max(sx(94), 94);
  const shoesH       = Math.max(sy(60), 60);
  const shoesLeft    = (sw - shoesW) / 2;   // centred under the outfit stack
  const shoesTop     = sy(479);
  // Bottom gradient starts at top:549
  const bottomGradTop = sy(549);

  // ── Bottom cluster — anchored from the BOTTOM edge so nothing hides
  // behind the nav bar (Figma: nav 787–830, card 622–771, pill 566–606 →
  // 16px gaps between nav/card and card/pill).
  const NAV_H        = 44;
  const CARD_H       = 149;
  const navBottom    = insets.bottom + 10;                 // matches NavBar
  const cardBottom   = navBottom + NAV_H + 16;             // card sits above nav
  const panelBottom  = cardBottom + CARD_H + 16;           // dressing row above card

  return (
    <View style={s.root}>
      <SkyBackground cloudPosition="top">

        {/* ── Location pill — Figma 424:241 ─────────────────────────── */}
        <Pressable
          style={[s.locationPill, { top: pillTop }]}
          onPress={() => router.push('/(onboarding)/location' as any)}
          hitSlop={8}
        >
          <View style={s.locationPillInner}>
            <Ionicons name="location-outline" size={12} color={Colors.surface[200]} />
            <Text style={s.locationText} numberOfLines={1}>
              {locationLabel || 'SET LOCATION'}
            </Text>
          </View>
        </Pressable>

        {/* ── PFP — Figma 592:40: top:56, right:20 ─────────────────── */}
        <Pressable
          style={[s.pfpWrap, { top: pfpTop }]}
          onPress={() =>
            Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Sign out',
                style: 'destructive',
                onPress: () => supabase.auth.signOut(),
              },
            ])
          }
          hitSlop={8}
        >
          <PfpCircle initial={initial} avatarUrl={avatarUrl} />
        </Pressable>

        {/* ── Heading — Figma 424:244 ───────────────────────────────── */}
        <Text style={[s.heading, { top: headingTop }]}>{heading}</Text>

        {/* ── Outfit images — Figma 424:254/255/256 ─────────────────── */}
        {/* Stacking: pants first, then shirt (shirt sits ON TOP of the */}
        {/* pants waistband), then shoes over the pant hems.            */}

        {/* Bottom item (pants) — rendered first so the shirt overlaps it */}
        {currentOutfit?.bottom?.imageUrl ? (
          <Image
            source={{ uri: currentOutfit.bottom.imageUrl }}
            style={[s.outfitImg, { left: botImgLeft, top: botImgTop, width: botImgW, height: botImgH }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[s.outfitPlaceholder, { left: botImgLeft, top: botImgTop, width: botImgW, height: botImgH }]} />
        )}

        {/* Top item (shirt) — rendered after pants → draws above them */}
        {currentOutfit?.top?.imageUrl ? (
          <Image
            source={{ uri: currentOutfit.top.imageUrl }}
            style={[s.outfitImg, { left: topImgLeft, top: topImgTop, width: topImgW, height: topImgH }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[s.outfitPlaceholder, { left: topImgLeft, top: topImgTop, width: topImgW, height: topImgH }]}>
            <Ionicons name="shirt-outline" size={32} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* Shoes */}
        {currentOutfit?.shoes?.imageUrl ? (
          <Image
            source={{ uri: currentOutfit.shoes.imageUrl }}
            style={[s.outfitImg, { left: shoesLeft, top: shoesTop, width: shoesW, height: shoesH }]}
            resizeMode="contain"
          />
        ) : (
          <View style={[s.outfitPlaceholder, { left: shoesLeft, top: shoesTop, width: shoesW, height: shoesH }]} />
        )}

        {/* ── Bottom white gradient — Figma 619:96: top:549, h:303 ──── */}
        <LinearGradient
          colors={['rgba(245,244,244,0)', Colors.surface[100], Colors.surface[100]]}
          locations={[0, 0.28, 1]}
          style={[s.bottomGrad, { top: bottomGradTop }]}
          pointerEvents="none"
        />

        {/* ── Dressing row — Figma 424:246+249 ────────────────────────── */}
        <View style={[s.dressingRow, { bottom: panelBottom }]}>

          {/* "I'M DRESSING FOR..." pill — Figma 424:246: w:231, radius 4, border */}
          <Pressable
            style={s.dressingPill}
            onPress={() => router.navigate('/(tabs)/outfit' as any)}
          >
            <Text style={s.dressingText}>I'M DRESSING FOR...</Text>
            <Ionicons name="chevron-down" size={10} color={Colors.surface[200]} />
          </Pressable>

          {/* Refresh-outfit + Outfit-maker buttons — Figma 424:250 + 675:242 */}
          <View style={s.iconGroup}>
            {/* Refresh outfit — annotation: "change to refresh outfit btn" */}
            <Pressable
              style={[s.iconBtn, refreshing && { opacity: 0.5 }]}
              onPress={handleRefreshOutfit}
              hitSlop={4}
              disabled={refreshing}
              accessibilityLabel="Refresh outfit"
            >
              <Ionicons name="refresh-outline" size={19} color={Colors.surface[200]} />
            </Pressable>
            {/* Outfit maker — Figma 675:242 (hanger). Stub → outfit tab for now. */}
            <Pressable
              style={s.iconBtn}
              onPress={() => router.navigate('/(tabs)/outfit' as any)}
              hitSlop={4}
              accessibilityLabel="Outfit maker"
            >
              <Ionicons name="shirt-outline" size={19} color={Colors.surface[200]} />
            </Pressable>
          </View>
        </View>

        {/* ── Weather card — Figma 619:99: solid surface-100, border, radius 8 */}
        {weather && (
          <View style={[s.weatherCard, { bottom: cardBottom }]}>
            <View style={s.cardInner}>
              {/* ── Left: IT'S CURRENTLY ──────────────────────── */}
              <View style={s.weatherLeft}>
                <Text style={s.weatherLabel}>IT'S CURRENTLY</Text>
                <View style={s.tempRow}>
                  {/* Auto-shrinks if it overflows the card; floor = 18px */}
                  <Text
                    style={s.tempValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={18 / 52}
                  >
                    {weather.temp}
                  </Text>
                  <Text style={s.tempDegree}>°</Text>
                </View>
                <Text style={s.metaText}>
                  {weather.windSpeed} KM/H — {weather.description.toUpperCase()}
                </Text>
              </View>

              <View style={s.cardDivider} />

              {/* ── Right: IT FEELS ───────────────────────────── */}
              <View style={s.weatherRight}>
                <Text style={s.weatherLabel}>IT FEELS</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.hourContent}
                  style={s.hourScroll}
                >
                  {weather.hourly.map((item, i) => (
                    <HourCell key={i} item={item} />
                  ))}
                </ScrollView>
                <Text style={s.metaText}>
                  {buildFeelsCaption(weather.feelsLike, weather.windSpeed)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* No-location prompt */}
        {!location && (
          <Pressable
            style={[s.noLocationBox, { bottom: cardBottom }]}
            onPress={() => router.push('/(onboarding)/location' as any)}
          >
            <Ionicons name="location-outline" size={18} color={Colors.surface[150]} />
            <Text style={s.noLocationText}>TAP TO SET YOUR LOCATION</Text>
          </Pressable>
        )}

      </SkyBackground>

      {/* ── Nav bar ──────────────────────────────────────────────────── */}
      <NavBar activeTab={2} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Location pill ──────────────────────────────────────────────────────────
  locationPill: { position: 'absolute', left: 20, zIndex: 10 },
  // Figma 424:241 — bg surface-100, 1px surface-200 border, radius 20
  locationPillInner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   4,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
    backgroundColor:   Colors.surface[100],
  },
  locationText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // ── PFP ────────────────────────────────────────────────────────────────────
  pfpWrap: { position: 'absolute', right: 20, zIndex: 10 },
  pfp: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: Colors.primary[100],
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.70)',
    overflow:        'hidden',
  },
  pfpImg:     { width: 34, height: 34, borderRadius: 17 },
  pfpInitial: {
    fontFamily: FontFamily.sansMedium,
    fontSize:   14,
    color:      Colors.surface[200],
  },

  // ── Heading ────────────────────────────────────────────────────────────────
  heading: {
    position:      'absolute',
    left:          20, right: 20,
    textAlign:     'center',
    fontFamily:    FontFamily.serif,
    fontSize:      24,
    lineHeight:    28,
    letterSpacing: -1.2,
    color:         Colors.surface[200],
    zIndex:        5,
  },

  // ── Outfit images ──────────────────────────────────────────────────────────
  // Absolutely positioned, layered like a mannequin (z-indices 1–3)
  outfitImg: {
    position: 'absolute',
    zIndex:   3,
  },
  outfitPlaceholder: {
    position:       'absolute',
    zIndex:         3,
    alignItems:     'center',
    justifyContent: 'center',
  },

  // ── Bottom gradient ────────────────────────────────────────────────────────
  bottomGrad: {
    position: 'absolute',
    left:     0,
    right:    0,
    height:   303,
    zIndex:   4,
  },

  // ── Dressing row — Figma 424:246+249 ──────────────────────────────────────
  dressingRow: {
    position:       'absolute',
    left:           20,
    right:          20,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    zIndex:         8,
  },
  // "I'M DRESSING FOR..." pill — w:231, py:12 (Figma 424:246)
  // Figma 424:246 — bg surface-100, 1px surface-200 border, radius 4, shadow-card
  dressingPill: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    width:             231,
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      4,
    borderWidth:       1,
    borderColor:       Colors.surface[200],
    backgroundColor:   Colors.surface[100],
    shadowColor:       '#1D1D1D',
    shadowOffset:      { width: 0, height: 13 },
    shadowOpacity:     0.05,
    shadowRadius:      14,
    elevation:         3,
  },
  dressingText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  // Refresh + Closet icon buttons — Figma 424:249, gap:16
  // Figma 675:245 — gap 12; buttons 40×40, radius 4, bordered
  iconGroup: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    4,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    backgroundColor: Colors.surface[100],
    shadowColor:     '#1D1D1D',
    shadowOffset:    { width: 0, height: 13 },
    shadowOpacity:   0.05,
    shadowRadius:    14,
    elevation:       3,
  },

  // ── Weather card — Figma 619:99: solid surface-100, 1px border, radius 8 ──
  weatherCard: {
    position:        'absolute',
    left:            20,
    right:           20,
    height:          149,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    backgroundColor: Colors.surface[100],
    shadowColor:     '#1D1D1D',
    shadowOffset:    { width: 0, height: 13 },
    shadowOpacity:   0.05,
    shadowRadius:    14,
    elevation:       6,
    zIndex:          8,
  },
  cardInner: {
    flex:              1,
    flexDirection:     'row',
    paddingHorizontal: 16,
    paddingVertical:   20,
    gap:               16,
  },
  // Left column — IT'S CURRENTLY + big temp
  weatherLeft: { flex: 1, gap: 8, justifyContent: 'space-between' },
  weatherLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  tempRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // Sized to fit the card's content box: 149 card − 40 padding = 109;
  // label(16) + gap(8) + temp(54) + gap(8) + meta(16) = 102 ✓ no clipping
  tempValue: {
    fontFamily:    FontFamily.dmSans,
    fontSize:      52,
    lineHeight:    54,
    letterSpacing: -1.04,
    color:         Colors.surface[200],
  },
  tempDegree: {
    fontFamily: FontFamily.sans,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.surface[200],
    marginTop:  8,
    marginLeft: 2,
  },
  // Figma 632:41 — 1px vertical divider
  cardDivider: {
    width:           1,
    alignSelf:       'stretch',
    backgroundColor: 'rgba(38,34,34,0.35)',
    marginVertical:  2,
  },
  // Right column — IT FEELS + hourly scroll + caption
  weatherRight:  { flex: 1, gap: 6 },
  hourScroll:    { marginHorizontal: -2 },
  hourContent:   { gap: 20, paddingVertical: 2 },
  hourCell:      { width: 53, alignItems: 'center', gap: 8 },
  hourTime: {
    fontFamily:    FontFamily.sans,
    fontSize:      14,
    lineHeight:    18,
    letterSpacing: -0.28,
    color:         Colors.surface[150],
    textTransform: 'uppercase',
    textAlign:     'center',
  },
  metaText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    color:         Colors.surface[150],
    textTransform: 'uppercase',
  },

  // ── No-location prompt ─────────────────────────────────────────────────────
  noLocationBox: {
    position:       'absolute',
    left:           20,
    right:          20,
    height:         56,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            10,
    backgroundColor: Colors.surface[100],
    borderRadius:   8,
    zIndex:         8,
  },
  noLocationText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[150],
  },
});
