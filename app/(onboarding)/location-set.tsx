// Figma node 308:26540 — "onboard | location set"
// Shown after the user confirms their city.
//
// Design annotations honoured:
//  • Sky gradient + parallax cloud via SkyBackground
//  • Location pill: tap → go back to change city
//  • Temperature: DM Sans 70px  •  Wind: "1.5 KM/H — CLEAR" format
//  • "IT FEELS" box: glass card with sky-gradient placeholder (stock video TBD)
//  • Feels-like caption: short phrase from feelsLike + windSpeed
//  • "[Name]" from onboarding name step (weatherStore.userName)
//  • Glass effect (expo-blur BlurView, intensity 80, tint "light") on weather card
//  • Hourly scroll: all available 3-hour forecast slots, Figma-exported icons
//  • Tutorial overlay (Figma 308:26722 + 308:26781):
//      – After 50 s idle → fade in dim overlay + hint text over 20 s
//      – After fade completes → closet button pulses to draw attention

import { useEffect, useRef, useState } from 'react';
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
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import SkyBackground from '@/components/SkyBackground';
import WeatherIcon from '@/components/WeatherIcon';
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

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LocationSetScreen() {
  const insets              = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
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
  // Figma 308:26779 — hint text sits at y:337 on the 852 frame
  const tutorialTextTop  = scaleY(337, screenH);

  // ── Tutorial fade-in (Figma 308:26722 → 308:26781) ────────────────────────
  // After 5 s idle the dark overlay + hint text fade in over 3 s.
  // Once the fade completes the closet button starts a gentle scale pulse.
  const tutorialOpacity      = useSharedValue(0);
  const closetScale          = useSharedValue(1);
  // Ref + state for floating closet button position
  const closetPlaceholderRef = useRef<View>(null);
  const [closetPos, setClosetPos] = useState<{ x: number; y: number } | null>(null);

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
  // White glow ring around the closet button — appears as tutorial fades in
  const closetRingStyle    = useAnimatedStyle(() => ({
    opacity: tutorialOpacity.value,
  }));
  // In-panel placeholder fades OUT as the floating button fades in
  const closetOriginalStyle = useAnimatedStyle(() => ({
    opacity: 1 - tutorialOpacity.value,
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
          <Pressable hitSlop={12} onPress={() => router.replace('/(tabs)')}>
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

        {/* ── Heading ───────────────────────────────────────────────── */}
        <Text style={[s.heading, { top: headingTop }]}>{heading}</Text>

        {/* ── Bottom panel: fade → glass card → hourly ──────────────── */}
        <LinearGradient
          colors={['rgba(245,244,244,0)', Colors.surface[100], Colors.surface[100]]}
          locations={[0, 0.22, 1]}
          style={[s.bottomPanel, { paddingBottom: insets.bottom + 16 }]}
        >

          {/* ── "I'm dressing for..." row ───────────────────────────── */}
          <View style={s.dressingRow}>
            <Pressable
              style={s.dressingPill}
              onPress={() => router.push('/(onboarding)/closet-setup')}
            >
              <Text style={s.dressingText}>I'M DRESSING FOR...</Text>
              <Ionicons name="chevron-down" size={10} color={Colors.surface[200]} />
            </Pressable>

            <View style={s.iconGroup}>
              <Pressable style={s.iconBtn} onPress={() => router.replace('/(tabs)/outfit')} hitSlop={4}>
                <Ionicons name="body-outline" size={19} color={Colors.surface[200]} />
              </Pressable>
              {/* Closet btn placeholder — fades out as tutorial fades in.        */}
              {/* A floating copy (zIndex 52, outside SkyBackground) takes over. */}
              <Animated.View style={closetOriginalStyle}>
                <View
                  ref={closetPlaceholderRef}
                  onLayout={() => {
                    closetPlaceholderRef.current?.measureInWindow((x, y) => {
                      setClosetPos({ x, y });
                    });
                  }}
                >
                  <Pressable style={s.iconBtn} onPress={() => router.replace('/(tabs)/closet')} hitSlop={4}>
                    <Ionicons name="shirt-outline" size={19} color={Colors.surface[200]} />
                  </Pressable>
                </View>
              </Animated.View>
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

          {/* ── Weather card (glass) ─────────────────────────────────── */}
          {weather && !loading && (
            <>
              <BlurView
                intensity={80}
                tint="light"
                style={s.glassCard}
              >
                {/* Glass rim — solid white 1.5px line at the very top, simulates light hitting the edge */}
                <View style={s.glassRim} pointerEvents="none" />

                {/* Gloss gradient — bright specular at top fading to transparent, the core of the glassy look */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.65)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.glossShine}
                  pointerEvents="none"
                />

                <LinearGradient
                  colors={['rgba(255,255,255,0.68)', 'rgba(255,255,255,0.36)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={s.cardInner}
                >

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

                  {/* Right — IT FEELS */}
                  <View style={s.weatherRight}>
                    <Text style={s.weatherLabel}>IT FEELS</Text>
                    {/* Annotation: "include stock video of current weather (i will provide)" */}
                    {/* Glass + sky gradient placeholder until stock video is supplied  */}
                    <View style={s.feelsBox}>
                      <LinearGradient
                        colors={Colors.gradient.clearSky.colors}
                        locations={Colors.gradient.clearSky.locations}
                        style={StyleSheet.absoluteFill}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                      {/* Current weather icon centred in the feels box */}
                      <View style={s.feelsIconWrap}>
                        <WeatherIcon conditionCode={weather.conditionCode} scale={1.3} />
                      </View>
                    </View>
                    {/* Annotation: "write something short according to the weather api" */}
                    <Text style={s.metaText}>
                      {buildFeelsCaption(weather.feelsLike, weather.windSpeed)}
                    </Text>
                  </View>

                </LinearGradient>
              </BlurView>

              {/* ── Hourly scroll ──────────────────────────────────────── */}
              {/* Annotation: "scrollable, goes up to 24 hours of the day" */}
              {weather.hourly.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.hourlyContent}
                  style={s.hourlyScroll}
                >
                  {weather.hourly.map((item, i) => (
                    <HourCell key={i} item={item} />
                  ))}
                </ScrollView>
              )}
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

      {/* ── Floating closet button ────────────────────────────────────── */}
      {/* Rendered outside SkyBackground (no overflow:hidden clip).       */}
      {/* Position mirrors the in-panel placeholder via measureInWindow.  */}
      {/* zIndex 52 > overlay (50) → only this button is above the dim.  */}
      {closetPos !== null && (
        <Animated.View
          style={[
            s.floatingCloset,
            { left: closetPos.x, top: closetPos.y },
            tutorialFadeStyle,
            closetScaleStyle,
          ]}
        >
          {/* Glow ring */}
          <Animated.View
            style={[StyleSheet.absoluteFill, s.closetRing, closetRingStyle]}
            pointerEvents="none"
          />
          <Pressable
            style={s.iconBtn}
            onPress={() => router.replace('/(tabs)/closet')}
            hitSlop={4}
          >
            <Ionicons name="shirt-outline" size={19} color={Colors.surface[200]} />
          </Pressable>
        </Animated.View>
      )}
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

  // ── Glass weather card ────────────────────────────────────────────────────
  // Figma: glass-bg effect (type GLASS, radius 12), border surface-100, radius 20
  // Gloss recipe: intensity-80 blur + glossShine gradient + bright rim + white-gradient inner.
  glassCard: {
    borderRadius:  20,
    overflow:      'hidden',
    marginBottom:  16,
    // Bright border — crisp specular edge around the whole card
    borderWidth:   1,
    borderColor:   'rgba(255,255,255,0.85)',
    // Soft depth shadow
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.10,
    shadowRadius:   16,
    elevation:      6,
  },
  // Solid white 1.5px line — sharpest light catch at the very top edge
  glassRim: {
    position:        'absolute',
    top:             0, left: 0, right: 0,
    height:          1.5,
    backgroundColor: 'rgba(255,255,255,1.0)',
    zIndex:          2,
  },
  // Full-card specular shine: bright at top, invisible at bottom (classic gloss)
  glossShine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 64,
    zIndex: 1,
  },
  cardInner: {
    flexDirection: 'row',
    padding:       20,
    gap:           16,
    zIndex:        1,
    // backgroundColor intentionally absent — LinearGradient handles the tint
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
  // Annotation: video placeholder — glass tinted box with sky gradient inside
  feelsBox: {
    height:          56,
    borderRadius:    12,
    overflow:        'hidden',
    alignItems:      'center',
    justifyContent:  'center',
  },
  feelsIconWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Floating closet button — sibling of SkyBackground, no overflow:hidden clip,
  // zIndex 52 > overlay (50) so only this element sits above the dim layer.
  floatingCloset: {
    position: 'absolute',
    zIndex:   52,
  },

  // White glow ring around the closet button (Figma 308:26781)
  // Opacity is driven by tutorialOpacity (0→1 with the fade)
  closetRing: {
    borderRadius:  22,      // iconBtn is 40×40 r:20; ring bleeds 2px outside
    margin:        -2,
    borderWidth:   2,
    borderColor:   'rgba(255,255,255,0.85)',
    shadowColor:   '#fff',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius:  8,
  },

  // ── Hourly scroll ─────────────────────────────────────────────────────────
  hourlyScroll: {
    marginHorizontal: -20, // bleed to screen edge
  },
  hourlyContent: {
    gap:               24,
    paddingHorizontal: 24, // Figma: content at left:44 = panel(20) + inner(24)
    paddingVertical:   4,
  },
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
