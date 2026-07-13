// Figma node 308:26540 — "onboard | location set"
// Shown after the user confirms their city.
//
// Design annotations honoured:
//  • Sky gradient + parallax cloud via SkyBackground
//  • Location pill: tap → go back to change city
//  • Temperature: DM Sans 70px  •  Wind: "1.5 KM/H — CLEAR" format
//  • "IT FEELS" box: solid card with hourly scroll
//  • Feels-like caption: short phrase from feelsLike + windSpeed
//  • "[Name]" from onboarding name step (weatherStore.userName)
//  • Weather card: solid surface-100, 1px surface-200 border (glass UI removed)
//  • Hourly scroll: all available 3-hour forecast slots, Figma-exported icons
//  • Tutorial overlay (Figma 308:26722 + 308:26781):
//      – After 50 s idle → fade in dim overlay + hint text over 20 s
//      – After fade completes → closet button pulses to draw attention

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import SkyBackground from '@/components/SkyBackground';
import WeatherIcon from '@/components/WeatherIcon';
import NavBar from '@/components/NavBar';
import { Colors } from '@/constants/Colors';
import { Typography, FontFamily } from '@/constants/Typography';
import { useWeatherStore, type HourlyItem } from '@/store/weatherStore';
import { fetchCurrentWeather, fetchHourlyForecast } from '@/lib/weather';

// ─── Figma frame reference (393 × 852) ───────────────────────────────────────
const FIGMA_H = 852;
function scaleY(y: number, screenH: number): number {
  return Math.round((y / FIGMA_H) * screenH);
}

// ─── Feels-like caption ───────────────────────────────────────────────────────
// Annotation: "write something short according to the weather api"
function buildFeelsCaption(feelsLike: number, windKph: number): string {
  if (windKph > 25) return feelsLike > 18 ? 'warm but quite windy' : 'cold and very windy';
  if (windKph > 12) return feelsLike > 20 ? 'warm but a little breezy' : 'cool and breezy';
  if (feelsLike > 28) return 'hot — dress light';
  if (feelsLike > 22) return 'warm and comfortable';
  if (feelsLike > 15) return 'mild — a light layer works';
  if (feelsLike > 5)  return 'cool — bring a jacket';
  return 'cold — bundle up';
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.dot, i < step ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );
}

// Hourly cell — Figma: 53px wide, icon on top, time caption below, gap 8
function HourCell({ item }: { item: HourlyItem }) {
  return (
    <View style={s.hourCell}>
      <WeatherIcon conditionCode={item.conditionCode} />
      <Text style={s.hourTime}>{item.time}</Text>
    </View>
  );
}

// Profile picture placeholder — Figma 387:134: 34×34 circle, top-right
function PfpCircle({ name }: { name: string | null }) {
  return (
    <View style={s.pfp}>
      <Text style={s.pfpInitial}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LocationSetScreen() {
  const insets              = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { location, displayLocation, weather, setWeather, userName } = useWeatherStore();

  const [loading,    setLoading]    = useState(!weather);
  const [error,      setError]      = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ── Fetch on mount / retry ─────────────────────────────────────────────────
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

  // ── Heading ────────────────────────────────────────────────────────────────
  const firstName = userName
    ? userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()
    : null;
  const heading = firstName
    ? `${firstName}, you'd look great\nin this`
    : `You'd look great\nin this`;

  const locationPillTop  = scaleY(86,  screenH);
  const headingTop       = scaleY(154, screenH);
  // PFP — Figma 387:134: top:81 + safe area, right:20
  const pfpTop           = scaleY(81,  screenH) + insets.top;
  // Figma 308:26779 — hint text sits at y:337 on the 852 frame
  const tutorialTextTop  = scaleY(337, screenH);

  // ── Tutorial fade-in (Figma 308:26722 → 308:26781) ────────────────────────
  // After 5 s idle the dark overlay + hint text fade in over 3 s.
  // Once the fade completes the closet button starts a gentle scale pulse.
  const tutorialOpacity      = useSharedValue(0);
  const closetScale          = useSharedValue(1);

  useEffect(() => {
    const tid = setTimeout(() => {
      tutorialOpacity.value = withTiming(1, { duration: 3_000 }, (finished) => {
        'worklet';
        if (finished) {
          closetScale.value = withRepeat(
            withTiming(1.07, { duration: 700, easing: Easing.inOut(Easing.ease) }),
            -1,
            true,
          );
        }
      });
    }, 5_000);
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tutorialFadeStyle  = useAnimatedStyle(() => ({ opacity: tutorialOpacity.value }));
  const closetScaleStyle   = useAnimatedStyle(() => ({
    transform: [{ scale: closetScale.value }],
  }));

  const locationLabel = displayLocation
    ? displayLocation.split(', ').slice(0, 2).join(', ')
    : location?.toUpperCase() ?? '';

  return (
    <View style={s.root}>
      <SkyBackground cloudPosition="top">

        {/* ── Top bar ───────────────────────────────────────────────── */}
        <View style={[s.topBar, { top: insets.top + 8 }]}>
          <ProgressDots step={3} total={4} />
          <Pressable hitSlop={12} onPress={() => { supabase.auth.updateUser({ data: { whether_onboarded: true } }); router.replace('/(tabs)'); }}>
            <Text style={s.skip}>SKIP</Text>
          </Pressable>
        </View>

        {/* ── Location pill ─────────────────────────────────────────── */}
        {/* Annotation: "ability to change/add location" */}
        <Pressable
          style={[s.locationPill, { top: locationPillTop }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <View style={s.locationPillGradient}>
            <Ionicons name="location-outline" size={12} color={Colors.surface[200]} />
            <Text style={s.locationText} numberOfLines={1}>{locationLabel}</Text>
          </View>
        </Pressable>

        {/* ── PFP — top right (Figma 387:134, 34×34) ───────────────── */}
        <View style={[s.pfpWrap, { top: pfpTop }]}>
          <PfpCircle name={firstName} />
        </View>

        {/* ── Heading ───────────────────────────────────────────────── */}
        <Text style={[s.heading, { top: headingTop }]}>{heading}</Text>

        {/* ── Bottom panel ─────────────────────────────────────────── */}
        {/* Extra bottom padding reserves space for NavBar           */}
        <LinearGradient
          colors={['rgba(245,244,244,0)', Colors.surface[100], Colors.surface[100]]}
          locations={[0, 0.22, 1]}
          style={[s.bottomPanel, { paddingBottom: insets.bottom + 76 }]}
        >

          {/* ── "I'm dressing for..." row ───────────────────────────── */}
          <View style={s.dressingRow}>
            <Pressable
              style={s.dressingPill}
              onPress={() => { supabase.auth.updateUser({ data: { whether_onboarded: true } }); router.push('/(onboarding)/closet-setup'); }}
            >
              <Text style={s.dressingText}>I'M DRESSING FOR...</Text>
              <Ionicons name="chevron-down" size={10} color={Colors.surface[200]} />
            </Pressable>

            {/* Refresh + outfit-maker buttons — mirrors home (Figma 675:602) */}
            <View style={s.iconGroup}>
              <Pressable style={s.iconBtn} onPress={() => { supabase.auth.updateUser({ data: { whether_onboarded: true } }); router.replace('/(tabs)/outfit'); }} hitSlop={4}>
                <Ionicons name="refresh-outline" size={19} color={Colors.surface[200]} />
              </Pressable>
              <Pressable style={s.iconBtn} onPress={() => { supabase.auth.updateUser({ data: { whether_onboarded: true } }); router.replace('/(tabs)/outfit'); }} hitSlop={4}>
                <Ionicons name="shirt-outline" size={19} color={Colors.surface[200]} />
              </Pressable>
            </View>
          </View>

          {/* ── Loading ─────────────────────────────────────────────── */}
          {loading && (
            <View style={s.stateBox}>
              <ActivityIndicator color={Colors.surface[150]} />
            </View>
          )}

          {/* ── Error ───────────────────────────────────────────────── */}
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

          {/* ── Weather card — solid surface-100, design-system border ── */}
          {weather && !loading && (
            <>
              <View style={s.weatherCard}>
                <View style={s.cardInner}>

                  {/* Left — IT'S CURRENTLY */}
                  <View style={s.weatherLeft}>
                    <Text style={s.weatherLabel}>IT'S CURRENTLY</Text>
                    <View style={s.tempRow}>
                      <Text style={s.tempValue}>{weather.temp}</Text>
                      <Text style={s.tempDegree}>°</Text>
                    </View>
                    {/* Annotation: "grab wind speed and format it like this" */}
                    <Text style={s.metaText}>
                      {weather.windSpeed} KM/H — {weather.description.toUpperCase()}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={s.cardDivider} />

                  {/* Right — IT FEELS + hourly scroll (Figma 308:26719) */}
                  {/* feelsBox video placeholder replaced by the hourly   */}
                  {/* scroll per Figma node 308:26540 update.             */}
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

                </View>
              </View>

              {/* Hourly scroll is now inside the IT FEELS right column */}
            </>
          )}

        </LinearGradient>

        {/* ── Tutorial overlay (Figma 308:26722 / 308:26781) ───────────── */}
        {/* Fades in after 50 s idle, over 20 s.                          */}
        {/* pointerEvents="none" so all underlying buttons stay tappable. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.tutorialOverlay, tutorialFadeStyle]}
          pointerEvents="none"
        />

        {/* Hint text — Figma 308:26779: Public Sans Medium 18px #ebebeb, w:268, top:337 */}
        <Animated.View
          style={[s.tutorialTextWrap, { top: tutorialTextTop }, tutorialFadeStyle]}
          pointerEvents="none"
        >
          <Text style={s.tutorialText}>
            NICE! LET'S GET STARTED BY BUILDING YOUR CLOSET.
          </Text>
        </Animated.View>

      </SkyBackground>

      {/* ── Nav bar — zIndex 55, above tutorial overlay (50) ────────── */}
      <NavBar activeTab={2} />

      {/* ── Tutorial camera highlight — Figma 675:602 tutorial frames ─── */}
      {/* Pulsing white spotlight behind the nav bar's camera slot.        */}
      {/* zIndex 54 sits above the dim overlay (50) and below NavBar (55). */}
      <Animated.View
        style={[
          s.cameraSpotlight,
          {
            left:   screenW / 2 - 22,
            bottom: insets.bottom + 10 - 0.5,   // centred on the 43px pill
          },
          tutorialFadeStyle,
          closetScaleStyle,
        ]}
        pointerEvents="none"
      />

      {/* During onboarding, the camera slot opens the closet tutorial     */}
      {/* (Figma 144:68) instead of the quick camera. Transparent overlay  */}
      {/* exactly over the nav camera section, above NavBar.               */}
      <Pressable
        style={[
          s.cameraSlotPress,
          { left: screenW / 2 - 25.5, bottom: insets.bottom + 10 },
        ]}
        onPress={() => { supabase.auth.updateUser({ data: { whether_onboarded: true } }); router.push('/(onboarding)/closet-setup'); }}
        accessibilityLabel="Start building your closet"
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position:       'absolute',
    left:           20, right: 20,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    zIndex:         10,
  },
  skip: { ...Typography.caption, color: Colors.surface[150] },

  // ── Progress dots — 9×9, gap 3 ───────────────────────────────────────────
  dots:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:    { width: 9, height: 9, borderRadius: 5 },
  dotOn:  { backgroundColor: Colors.surface[200] },
  dotOff: { backgroundColor: 'rgba(43,30,30,0.18)' },

  // ── Location pill ─────────────────────────────────────────────────────────
  locationPill: { position: 'absolute', left: 20, zIndex: 10 },
  // Solid surface-100 pill with surface-200 border (glass UI removed)
  locationPillGradient: {
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
  locationText: { ...Typography.caption, color: Colors.surface[200] },

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
  dressingText: { ...Typography.caption, color: Colors.surface[200] },
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

  // ── State boxes (loading / error) ────────────────────────────────────────
  stateBox: {
    height:         100,
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   12,
  },

  // ── Weather card — solid surface-100, 1px surface-200 border (no glass) ──
  weatherCard: {
    borderRadius:    8,
    overflow:        'hidden',
    marginBottom:    16,
    borderWidth:     1,
    borderColor:     Colors.surface[200],
    backgroundColor: Colors.surface[100],
    shadowColor:     '#1D1D1D',
    shadowOffset:    { width: 0, height: 13 },
    shadowOpacity:   0.05,
    shadowRadius:    14,
    elevation:       6,
  },
  cardInner: {
    flexDirection: 'row',
    padding:       20,
    gap:           16,
  },

  // Left column
  weatherLeft: { flex: 1, gap: 8 },
  weatherLabel: { ...Typography.caption, color: Colors.surface[200] },
  tempRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  // Figma: DM Sans Regular, 70px, tracking -1.4px
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

  // Hairline divider between columns
  cardDivider: {
    width:           StyleSheet.hairlineWidth,
    alignSelf:       'stretch',
    backgroundColor: 'rgba(43,30,30,0.12)',
    marginVertical:  4,
  },

  // Right column
  weatherRight: { width: 137, gap: 6 },

  // PFP circle — 34×34, top-right of panel, primary-100 fill with white rim
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

  // Mini hourly scroll inside right column
  miniHourScroll: {
    marginHorizontal: -2,
  },
  miniHourContent: {
    gap:             20,
    paddingVertical: 2,
  },

  metaText: {
    fontFamily:    FontFamily.sans,
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.15,
    color:         Colors.surface[150],
    textTransform: 'uppercase',
  },

  // ── Tutorial overlay ─────────────────────────────────────────────────────
  // Figma 308:26778: full-screen rgba(43,30,30,0.30) dim — surface-200 @ 30 %
  tutorialOverlay: {
    backgroundColor: 'rgba(43,30,30,0.30)',
    zIndex: 50,
  },
  // Hint text container — positioned with tutorialTextTop (scaleY from Figma y:337)
  tutorialTextWrap: {
    position:   'absolute',
    left:        0,
    right:       0,
    alignItems: 'center',
    zIndex:      51,
  },
  // Figma 308:26779: Public Sans Medium, 18px, #ebebeb, w:268, tracking -0.36
  tutorialText: {
    fontFamily:    FontFamily.sansMedium,
    fontSize:      18,
    lineHeight:    22,
    letterSpacing: -0.36,
    textTransform: 'uppercase',
    color:         '#ebebeb',
    textAlign:     'center',
    width:         268,
  },
  // Tutorial camera spotlight — pulsing white circle behind the nav bar's
  // camera slot (Figma 675:602 tutorial frames). Nav pill is 153×43 centred;
  // the camera slot is its middle third → screen-centred 44px circle.
  cameraSpotlight: {
    position:        'absolute',
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor:     '#fff',
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.9,
    shadowRadius:    10,
    zIndex:          54,
  },
  // Transparent pressable over the camera slot — routes to the closet
  // tutorial during onboarding (zIndex 56 > NavBar 55).
  cameraSlotPress: {
    position: 'absolute',
    width:    51,   // pill 153 / 3
    height:   43,
    zIndex:   56,
  },

  // ── Hourly scroll (shared cell styles) ───────────────────────────────────
  // Each cell — 53px wide (matches Figma), icon above, time below, gap 8
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
});
