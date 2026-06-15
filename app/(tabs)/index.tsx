// Figma node 308:26540 — "onboard | location set" (main app version)
//
// Home / weather tab. Same sky + weather layout as the onboarding
// location-set screen but without progress dots or skip button.
// The nav bar is rendered by the (tabs) layout, not here.
//
// Layout delta vs onboarding:
//  • Hourly scroll lives INSIDE the "IT FEELS" right column (no separate row)
//  • feelsBox (video placeholder) removed
//  • PFP circle top-right  (Figma node 387:134)
//  • Bottom panel padding accounts for the floating GlassNavBar

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import { supabase } from '@/lib/supabase';
import WeatherIcon from '@/components/WeatherIcon';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/Typography';
import { useWeatherStore, type HourlyItem } from '@/store/weatherStore';
import { fetchCurrentWeather, fetchHourlyForecast } from '@/lib/weather';

// ─── Figma frame reference ────────────────────────────────────────────────────
const FIGMA_H = 852;
function scaleY(y: number, screenH: number) {
  return Math.round((y / FIGMA_H) * screenH);
}

// ─── Feels-like caption ───────────────────────────────────────────────────────
function buildFeelsCaption(feelsLike: number, windKph: number): string {
  if (windKph > 25) return feelsLike > 18 ? 'warm but quite windy' : 'cold and very windy';
  if (windKph > 12) return feelsLike > 20 ? 'warm but a little breezy' : 'cool and breezy';
  if (feelsLike > 28) return 'hot — dress light';
  if (feelsLike > 22) return 'warm and comfortable';
  if (feelsLike > 15) return 'mild — a light layer works';
  if (feelsLike > 5)  return 'cool — bring a jacket';
  return 'cold — bundle up';
}

// ─── Hourly cell ─────────────────────────────────────────────────────────────
function HourCell({ item }: { item: HourlyItem }) {
  return (
    <View style={s.hourCell}>
      <WeatherIcon conditionCode={item.conditionCode} />
      <Text style={s.hourTime}>{item.time}</Text>
    </View>
  );
}

// ─── Profile picture placeholder ─────────────────────────────────────────────
// Figma 387:134 — 34×34 circle. Shows initial until the user adds a photo.
function PfpCircle({ name }: { name: string | null }) {
  return (
    <View style={s.pfp}>
      <Text style={s.pfpInitial}>
        {name ? name.charAt(0).toUpperCase() : '?'}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets              = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { location, displayLocation, weather, setWeather, userName } =
    useWeatherStore();

  const [loading,    setLoading]    = useState(!weather);
  const [error,      setError]      = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ── Fetch weather ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!location) return;
    if (weather && retryCount === 0) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const [current, hourly] = await Promise.all([
          fetchCurrentWeather(location),
          fetchHourlyForecast(location),
        ]);
        if (!cancelled) { setWeather({ ...current, hourly }); setLoading(false); }
      } catch {
        if (!cancelled) {
          setError('Could not load weather.\nCheck your connection.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, retryCount]);

  // ── Positions (Figma → device) ────────────────────────────────────────────
  const locationPillTop = scaleY(86, screenH);
  const headingTop      = scaleY(154, screenH);
  // PFP — Figma: top:81, left: calc(83.33%+11.5px) ≈ right:20
  const pfpTop          = scaleY(81, screenH) + insets.top;

  const firstName = userName
    ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()
    : null;
  const heading = firstName
    ? `${firstName}, you'd look great\nin this`
    : `You'd look great\nin this`;

  const locationLabel = displayLocation
    ? displayLocation.split(', ').slice(0, 2).join(', ')
    : location?.toUpperCase() ?? '';

  return (
    <View style={s.root}>
      <SkyBackground cloudPosition="top">

        {/* ── Location pill ─────────────────────────────────────── */}
        <Pressable
          style={[s.locationPill, { top: locationPillTop }]}
          onPress={() => router.push('/(onboarding)/location' as any)}
          hitSlop={8}
        >
          <LinearGradient
            colors={[Colors.surface[100], 'rgba(245,244,244,0)']}
            start={{ x: 0, y: 1 }}
            end={{ x: 0, y: 0 }}
            style={s.locationPillGradient}
          >
            <Ionicons name="location-outline" size={12} color={Colors.surface[200]} />
            <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
          </LinearGradient>
        </Pressable>

        {/* ── PFP — top right (Figma 387:134, 34×34) ────────────── */}
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
          <PfpCircle name={firstName} />
        </Pressable>

        {/* ── Heading ───────────────────────────────────────────── */}
        <Text style={[s.heading, { top: headingTop }]}>{heading}</Text>

        {/* ── Bottom panel ─────────────────────────────────────── */}
        {/* Extra bottom padding reserves space for the GlassNavBar */}
        <LinearGradient
          colors={['rgba(245,244,244,0)', Colors.surface[100], Colors.surface[100]]}
          locations={[0, 0.22, 1]}
          style={[s.bottomPanel, { paddingBottom: insets.bottom + 76 }]}
        >

          {/* ── Dressing row ────────────────────────────────────── */}
          <View style={s.dressingRow}>
            <Pressable
              style={s.dressingPill}
              onPress={() => router.push('/(onboarding)/closet-setup' as any)}
            >
              <Text style={s.dressingText}>I'M DRESSING FOR...</Text>
              <Ionicons name="chevron-down" size={10} color={Colors.surface[200]} />
            </Pressable>
            <View style={s.iconGroup}>
              <Pressable
                style={s.iconBtn}
                onPress={() => router.navigate('/(tabs)/outfit' as any)}
                hitSlop={4}
              >
                <Ionicons name="body-outline" size={19} color={Colors.surface[200]} />
              </Pressable>
              <Pressable
                style={s.iconBtn}
                onPress={() => router.push('/(onboarding)/closet-setup' as any)}
                hitSlop={4}
              >
                <Ionicons name="shirt-outline" size={19} color={Colors.surface[200]} />
              </Pressable>
            </View>
          </View>

          {/* ── Loading ───────────────────────────────────────────── */}
          {loading && (
            <View style={s.stateBox}>
              <ActivityIndicator color={Colors.surface[150]} />
            </View>
          )}

          {/* ── Error ─────────────────────────────────────────────── */}
          {error && !loading && (
            <View style={s.stateBox}>
              <Text style={s.metaText}>{error}</Text>
              <Pressable onPress={() => setRetryCount((c) => c + 1)} hitSlop={8}>
                <Text style={[s.metaText, { textDecorationLine: 'underline', marginTop: 8 }]}>
                  TAP TO RETRY
                </Text>
              </Pressable>
            </View>
          )}

          {/* ── Weather glass card ──────────────────────────────── */}
          {weather && !loading && (
            <BlurView intensity={80} tint="light" style={s.glassCard}>
              {/* Specular rim */}
              <View style={s.glassRim} pointerEvents="none" />
              {/* Top-of-card gloss shine */}
              <LinearGradient
                colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={s.glossShine}
                pointerEvents="none"
              />
              {/* Card body — gradient tint (bright top → translucent bottom) */}
              <LinearGradient
                colors={['rgba(255,255,255,0.68)', 'rgba(255,255,255,0.36)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={s.cardInner}
              >
                {/* ── Left: current temp ──────────────────────── */}
                <View style={s.weatherLeft}>
                  <Text style={s.weatherLabel}>IT'S CURRENTLY</Text>
                  <View style={s.tempRow}>
                    <Text style={s.tempValue}>{weather.temp}</Text>
                    <Text style={s.tempDegree}>°</Text>
                  </View>
                  <Text style={s.metaText}>
                    {weather.windSpeed} KM/H — {weather.description.toUpperCase()}
                  </Text>
                </View>

                <View style={s.cardDivider} />

                {/* ── Right: IT FEELS + hourly scroll + caption ── */}
                {/* Figma 308:26719 — hourly scroll replaces the    */}
                {/* feelsBox stock-video placeholder.                */}
                <View style={s.weatherRight}>
                  <Text style={s.weatherLabel}>IT FEELS</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.miniHourContent}
                    style={s.miniHourScroll}
                  >
                    {weather.hourly.map((item, i) => (
                      <HourCell key={i} item={item} />
                    ))}
                  </ScrollView>
                  <Text style={s.metaText}>
                    {buildFeelsCaption(weather.feelsLike, weather.windSpeed)}
                  </Text>
                </View>
              </LinearGradient>
            </BlurView>
          )}

        </LinearGradient>
      </SkyBackground>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Location pill ────────────────────────────────────────────────────────
  locationPill: { position: 'absolute', left: 20, zIndex: 10 },
  locationPillGradient: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   4,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.surface[100],
  },
  locationText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },

  // ── PFP — Figma 387:134: 34×34 circle, top-right ─────────────────────────
  pfpWrap: {
    position: 'absolute',
    right:    20,
    zIndex:   10,
  },
  pfp: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: Colors.primary[100],
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     'rgba(255,255,255,0.70)',
  },
  pfpInitial: {
    fontFamily: FontFamily.sansMedium,
    fontSize:   14,
    color:      Colors.surface[200],
  },

  // ── Heading ───────────────────────────────────────────────────────────────
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

  // ── Bottom panel ──────────────────────────────────────────────────────────
  bottomPanel: {
    position:          'absolute',
    bottom:            0, left: 0, right: 0,
    paddingTop:        24,
    paddingHorizontal: 20,
  },

  // ── Dressing row ─────────────────────────────────────────────────────────
  dressingRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   14,
  },
  dressingPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 12,
    paddingVertical:   12,
    borderRadius:      30,
    backgroundColor:   Colors.surface[100],
    shadowColor:       Colors.surface[200],
    shadowOffset:      { width: 0, height: 1 },
    shadowOpacity:     0.06,
    shadowRadius:      6,
    elevation:         2,
  },
  dressingText: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  iconGroup:    { flexDirection: 'row', gap: 12 },
  iconBtn: {
    width:           40, height: 40,
    borderRadius:    20,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: Colors.surface[100],
    shadowColor:     Colors.surface[200],
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.06,
    shadowRadius:    6,
    elevation:       2,
  },

  // ── State boxes ───────────────────────────────────────────────────────────
  stateBox: {
    height:         100,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   12,
  },

  // ── Glass weather card ────────────────────────────────────────────────────
  glassCard: {
    borderRadius:  20,
    overflow:      'hidden',
    marginBottom:  16,
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.85)',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
    elevation:     6,
  },
  glassRim: {
    position:        'absolute',
    top: 0, left: 0, right: 0,
    height:          1.5,
    backgroundColor: 'rgba(255,255,255,1.0)',
    zIndex:          2,
  },
  glossShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height:   64,
    zIndex:   1,
  },
  cardInner: {
    flexDirection: 'row',
    padding:       20,
    gap:           16,
    zIndex:        1,
  },

  // Left column
  weatherLeft:  { flex: 1, gap: 8 },
  weatherLabel: {
    fontFamily:    FontFamily.sans,
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color:         Colors.surface[200],
  },
  tempRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  tempValue: {
    fontFamily:    FontFamily.dmSans,
    fontSize:      70,
    lineHeight:    76,
    letterSpacing: -1.4,
    color:         Colors.surface[200],
  },
  tempDegree: {
    fontFamily: FontFamily.sans,
    fontSize:   14,
    lineHeight: 16,
    color:      Colors.surface[200],
    marginTop:  10,
    marginLeft: 2,
  },

  cardDivider: {
    width:           StyleSheet.hairlineWidth,
    alignSelf:       'stretch',
    backgroundColor: 'rgba(43,30,30,0.12)',
    marginVertical:  4,
  },

  // Right column — IT FEELS + mini hourly scroll + caption
  // Figma 308:26719: w:137, gap:8
  weatherRight: { width: 137, gap: 6 },

  // Mini hourly scroll inside the right column
  // Figma 372:110: overflow-x, gap:24, same HourCell components
  miniHourScroll: {
    marginHorizontal: -2,
  },
  miniHourContent: {
    gap:           20,
    paddingVertical: 2,
  },

  // Shared hour cell (same spec as the full-width scroll in location-set)
  hourCell: {
    width:      53,
    alignItems: 'center',
    gap:        8,
  },
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
});
