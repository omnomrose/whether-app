// Onboarding — city/location picker
// Figma 144:45 (Search Container collapsed) + 144:456 (Search Container expanded)
// Frame: 393 × 852
//
// Key design decisions:
//  - Card is ALWAYS full-width (left:0, right:0) — only `top` and `maxHeight` morph
//  - Morph runs on the Reanimated UI thread (withTiming) for a native 60fps feel
//  - Glass card: pure-RN layered approach (base fill + sheen + shadow) — no native blur needed
//  - LinearGradient header matches the Figma fade-from-surface overlay
//  - Location button is ABOVE the search bar (corrected from earlier reversed order)
//  - Result rows: building icon + highlighted query match + muted remainder

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

import WebView from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { useWeatherStore } from '@/store/weatherStore';

// ─── Figma constants (frame 393 × 852) ───────────────────────────────────────
const FIGMA_H         = 852;
// Search Container positions
const CARD_TOP_IDLE   = 672;   // node 161:256
const CARD_TOP_FOCUS  = 481;   // node 189:435
const CARD_H_IDLE     = 180;   // node 161:256
const CARD_H_FOCUS    = 371;   // node 189:435
// Results list
const RESULTS_MAX_H   = 130;   // node 189:446 height
const THUMB_H         = 35;
// ─────────────────────────────────────────────────────────────────────────────

// ─── Morph animation configs ──────────────────────────────────────────────────
// Both position and height now use springs so the whole card grows as one
// fluid, bouncy unit — matching the closet tutorial card motion language.
const SPRING_EXPAND   = { damping: 18, stiffness: 180, mass: 1 }; // bouncy open
const SPRING_COLLAPSE = { damping: 26, stiffness: 220, mass: 1 }; // snappy close
const HEIGHT_SPRING   = { damping: 22, stiffness: 200, mass: 0.9 }; // height grow
// Keyboard-driven repositions stay timing-based to match iOS keyboard spring.
const KB_TIMING       = { duration: 250, easing: Easing.out(Easing.ease) };
const KB_RESTORE      = { duration: 400, easing: Easing.inOut(Easing.cubic) };
// ─────────────────────────────────────────────────────────────────────────────

// ─── Leaflet map HTML ─────────────────────────────────────────────────────────
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#eae6df}
    #map{width:100%;height:100%}
    .leaflet-control-container{display:none}
    .leaflet-tile{transition:opacity .12s ease-in}
  </style>
</head>
<body><div id="map"></div>
<script>
if('serviceWorker'in navigator&&'caches'in window){
  const sw=\`const C='osm-v1';self.addEventListener('fetch',e=>{if(!e.request.url.includes('tile.openstreetmap.org'))return;e.respondWith(caches.open(C).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{c.put(e.request,res.clone());return res}))));});\`;
  navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw],{type:'text/javascript'}))).catch(()=>{});
}
var map=L.map('map',{
  zoomControl:false,attributionControl:false,preferCanvas:true,
  dragging:true,touchZoom:true,doubleClickZoom:false,
  scrollWheelZoom:false,bounceAtZoomLimits:false,
  zoomAnimation:true,fadeAnimation:true,
}).setView([49.2827,-123.1207],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:18,minZoom:3,subdomains:'abc',detectRetina:true,
  keepBuffer:8,updateWhenIdle:true,updateWhenZooming:false,
  updateInterval:150,crossOrigin:true
}).addTo(map);
function onMsg(e){try{var d=JSON.parse(e.data);if(d.type==='flyTo')map.flyTo([d.lat,d.lng],d.zoom||12,{animate:true,duration:0.9,easeLinearity:0.2});}catch(_){}}
window.addEventListener('message',onMsg);document.addEventListener('message',onMsg);
</script></body></html>`;

// ─── Nominatim search ─────────────────────────────────────────────────────────
type GeoResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
  type?: string;
  class?: string;
};

/** Returns up to 7 deduplicated city results for the query. */
async function searchCities(q: string): Promise<GeoResult[]> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}&format=json&limit=12` +
      `&addressdetails=1&accept-language=en&featuretype=city`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'whether-app/1.0' } });
    const data = await res.json() as GeoResult[];

    // Deduplicate by city-name + country key, then fall back to display_name prefix
    const seen = new Set<string>();
    const out: GeoResult[] = [];
    for (const r of data) {
      const city = r.address?.city || r.address?.town || r.address?.village
                || r.address?.municipality || r.display_name.split(',')[0];
      const country = r.address?.country || '';
      const key = `${city.toLowerCase()}|${country.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
      if (out.length === 7) break;
    }
    return out;
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'whether-app/1.0' } }
    );
    const d = await res.json();
    return d.address?.city || d.address?.town || d.address?.municipality || 'Current Location';
  } catch {
    return 'Current Location';
  }
}

/** Build a clean display label: "CITY, REGION" or "CITY, COUNTRY". */
function buildLabel(r: GeoResult): string {
  const parts = r.display_name.split(',').map(p => p.trim()).filter(Boolean);
  // Always show first part (city name). Add region/state or country as context.
  const region = r.address?.state || r.address?.province || r.address?.country || parts[1] || '';
  return region ? `${parts[0]}, ${region}`.toUpperCase() : parts[0].toUpperCase();
}

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.dot, i < step ? s.dotOn : s.dotOff]} />
      ))}
    </View>
  );
}

// ─── Custom scrollbar ─────────────────────────────────────────────────────────
// Figma: w-2, h-35, #d9d9d9 pill — positioned at right edge of results
function CustomScrollbar({
  contentH,
  containerH,
  scrollY,
}: {
  contentH:   number;
  containerH: number;
  scrollY:    number;
}) {
  if (contentH <= containerH) return null;
  const maxScroll = contentH - containerH;
  const trackH    = containerH - THUMB_H;
  const thumbTop  = Math.min((scrollY / maxScroll) * trackH, trackH);

  return (
    <View style={[s.scrollTrack, { height: containerH }]} pointerEvents="none">
      <View style={[s.scrollThumb, { top: thumbTop }]} />
    </View>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────
// Splits label at the query match point: matched portion is surface-200, rest is surface-30
function ResultRow({
  result,
  query,
  onPress,
}: {
  result:  GeoResult;
  query:   string;
  onPress: () => void;
}) {
  const label    = buildLabel(result);
  const queryUC  = query.toUpperCase().trim();
  const matchIdx = queryUC ? label.indexOf(queryUC) : -1;

  return (
    <Pressable style={s.resultRow} onPress={onPress} hitSlop={4}>
      <Ionicons
        name="business-outline"
        size={16}
        color={Colors.surface[30]}
        style={s.resultIcon}
      />
      {matchIdx === -1 ? (
        <Text style={s.resultDim} numberOfLines={1}>{label}</Text>
      ) : (
        <Text style={s.resultDim} numberOfLines={1}>
          {matchIdx > 0 && (
            <Text style={s.resultDim}>{label.slice(0, matchIdx)}</Text>
          )}
          <Text style={s.resultMatch}>{label.slice(matchIdx, matchIdx + queryUC.length)}</Text>
          {matchIdx + queryUC.length < label.length && (
            <Text style={s.resultDim}>{label.slice(matchIdx + queryUC.length)}</Text>
          )}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LocationScreen() {
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<GeoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [contentH,    setContentH]    = useState(0);
  const [scrollY,     setScrollY]     = useState(0);

  const webRef       = useRef<WebView>(null);
  const inputRef     = useRef<TextInput>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dismissingRef = useRef(false);
  const searchingRef  = useRef(false);

  const { setLocation, setDisplayLocation } = useWeatherStore();

  const insets              = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  // Scale Figma positions to actual device height
  const idleTop  = (CARD_TOP_IDLE  / FIGMA_H) * screenH;
  const focusTop = (CARD_TOP_FOCUS / FIGMA_H) * screenH;
  const idleH    = (CARD_H_IDLE    / FIGMA_H) * screenH;
  const focusH   = (CARD_H_FOCUS   / FIGMA_H) * screenH;

  // ── Reanimated shared values for the morph ──────────────────────────────
  // `height` (not maxHeight) so the glass panel always fills its designed
  // Figma footprint — empty space below results is intentional per the design.
  const cardTop = useSharedValue(idleTop);
  const cardH   = useSharedValue(idleH);

  const cardStyle = useAnimatedStyle(() => ({
    top:    cardTop.value,
    height: cardH.value,
  }));

  // Sync if screen dimensions change (rotation, etc.)
  useEffect(() => {
    if (!searchingRef.current) {
      cardTop.value = idleTop;
      cardH.value   = idleH;
    }
  }, [idleTop, idleH]);

  // ── Keyboard-aware card positioning ──────────────────────────────────────
  // On iOS, use "Will" events so the card animates in sync with the keyboard.
  // headerBottom = safe-area top + header height + breathing room.
  // The card is clamped to never slide under the header.
  useEffect(() => {
    const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(SHOW, (e) => {
      if (!searchingRef.current) return;
      const kbH          = e.endCoordinates.height;
      const headerBottom = insets.top + 133 + 8;
      const above        = screenH - kbH - focusH - 8;
      const target       = Math.max(above, headerBottom);
      cardTop.value = withTiming(target, KB_TIMING);
    });

    const hideSub = Keyboard.addListener(HIDE, () => {
      if (searchingRef.current && !dismissingRef.current) {
        cardTop.value = withTiming(focusTop, KB_RESTORE);
      }
    });

    // Collapse when keyboard is fully hidden after a dismiss gesture
    const didHideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (searchingRef.current && !dismissingRef.current) dismissSearch();
    });

    return () => { showSub.remove(); hideSub.remove(); didHideSub.remove(); };
  }, [screenH, focusTop, focusH, insets.top]);

  // ── Map control ─────────────────────────────────────────────────────────
  const flyTo = (lat: number, lng: number, zoom = 12) =>
    webRef.current?.injectJavaScript(
      `map.flyTo([${lat},${lng}],${zoom},{animate:true,duration:0.9,easeLinearity:0.2});true;`
    );

  // ── Morph helpers ────────────────────────────────────────────────────────
  // top   → spring (bouncy position change, feels physical)
  // height → easeInOut cubic (smooth reveal, no awkward content clipping)
  const expandCard = useCallback(() => {
    cardTop.value = withSpring(focusTop, SPRING_EXPAND);
    cardH.value   = withSpring(focusH,   HEIGHT_SPRING);
  }, [focusTop, focusH]);

  const collapseCard = useCallback(() => {
    cardTop.value = withSpring(idleTop, SPRING_COLLAPSE);
    cardH.value   = withSpring(idleH,   HEIGHT_SPRING);
  }, [idleTop, idleH]);

  const handleFocus = () => {
    searchingRef.current = true;
    setIsSearching(true);
    expandCard();
  };

  const dismissSearch = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    searchingRef.current  = false;
    setIsSearching(false);
    collapseCard();
    setTimeout(() => {
      setResults([]);
      setScrollY(0);
      dismissingRef.current = false;
    }, 460); // ~HEIGHT_SPRING settle time
  }, [collapseCard]);

  // ── Autocomplete ─────────────────────────────────────────────────────────
  const handleQueryChange = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setResults(await searchCities(text));
      setLoading(false);
    }, 280);
  };

  const handleSelect = (result: GeoResult) => {
    const label = buildLabel(result); // "VANCOUVER, BRITISH COLUMBIA"
    // Prefer the specific city/town name for the weather API query
    const cityForApi =
      result.address?.city ||
      result.address?.town ||
      result.address?.municipality ||
      result.display_name.split(',')[0];

    flyTo(parseFloat(result.lat), parseFloat(result.lon));
    setQuery(label.split(',')[0]);
    setLocation(cityForApi);
    setDisplayLocation(label);
    Keyboard.dismiss();
    dismissSearch();
    // Wait for the collapse animation to start before pushing the next screen
    setTimeout(() => router.push('/(onboarding)/location-set'), 500);
  };

  const handleSubmit = async () => {
    if (results.length > 0) { handleSelect(results[0]); return; }
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    const r = await searchCities(q);
    if (r[0]) handleSelect(r[0]);
    setLoading(false);
  };

  const handleCurrentLocation = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    setLoading(true);
    Keyboard.dismiss();
    dismissSearch();
    const pos      = await ExpoLocation.getCurrentPositionAsync({});
    flyTo(pos.coords.latitude, pos.coords.longitude, 13);
    const cityName = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    setQuery(cityName);
    setLocation(cityName);
    setDisplayLocation(cityName.toUpperCase());
    setLoading(false);
    router.push('/(onboarding)/location-set');
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  };

  const showResults = isSearching && results.length > 0;

  return (
    <View style={s.root}>

      {/* ── Map ─────────────────────────────────────────────────── */}
      <WebView
        ref={webRef}
        source={{ html: MAP_HTML }}
        style={s.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />

      {/* ── Header — Figma node 185:347 ──────────────────────────────────── */}
      {/* glass-linear: transparent (top) → solid #f5f4f4 (bottom)            */}
      {/* glass-bg radius:12 — approximated with a 3-stop gradient that        */}
      {/* ramps up opacity gradually, giving a frosted-in-from-above look.     */}
      {/* justify-end pins progress + title to the solid bottom of the pane.   */}
      <LinearGradient
        colors={[
          'rgba(245,244,244,0)',    // 0 %  — fully transparent, map shows through
          'rgba(245,244,244,0.72)', // 48 % — soft midpoint (simulates blur diffusion)
          Colors.surface[100],     // 100 % — fully solid behind the title
        ]}
        locations={[0, 0.48, 1]}
        style={[s.header, { paddingTop: insets.top + 4 }]}
        pointerEvents="box-none"
      >
        <View style={s.headerRow}>
          <ProgressDots step={2} total={4} />
          <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={12}>
            <Text style={s.skip}>SKIP</Text>
          </Pressable>
        </View>
        <Text style={s.title}>Which city are you based in?</Text>
      </LinearGradient>

      {/* ── Morphing Search Container ─────────────────────────── */}
      <Animated.View style={[s.card, cardStyle]}>
        {/* ── Pure-RN glass layers (no native blur — BlurView can't blur WebView) */}
        {/* 1. glass-linear — surface-100 solid at bottom, transparent at top     */}
        {/*    Same gradient recipe as ClosetTutorialCard for consistent glass fx  */}
        <LinearGradient
          colors={['#f5f4f4', 'rgba(245,244,244,0)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[StyleSheet.absoluteFill, s.glassBase]}
        />
        {/* 2. Specular shine — bright at top, fades to transparent (classic gloss) */}
        <LinearGradient
          colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.glossShine}
          pointerEvents="none"
        />
        {/* 3. Rim — 1.5 px solid white line catches light at the very top edge  */}
        <View style={s.glassRim} pointerEvents="none" />

        <View style={s.inner}>

          {/* ── Top group: location btn + search bar (gap 12) ── */}
          <View style={s.topGroup}>

            {/* 1 — Use current location (location btn always on top) */}
            <Pressable style={s.locationRow} onPress={handleCurrentLocation}>
              <Ionicons
                name="location-outline"
                size={16}
                color={Colors.surface[150]}
              />
              <Text style={s.locationText}>USE CURRENT LOCATION</Text>
            </Pressable>

            {/* 2 — Search bar */}
            <View style={[s.searchBar, isSearching && s.searchBarActive]}>
              <Ionicons
                name="search-outline"
                size={13}
                color={isSearching ? Colors.surface[200] : Colors.surface[150]}
              />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={handleQueryChange}
                onSubmitEditing={handleSubmit}
                onFocus={handleFocus}
                placeholder="SEARCH FOR A CITY"
                placeholderTextColor={Colors.surface[150]}
                returnKeyType="search"
                autoCapitalize="characters"
                autoCorrect={false}
                style={s.searchInput}
              />
              {loading ? (
                <ActivityIndicator size="small" color={Colors.surface[150]} />
              ) : isSearching && query.length > 0 ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => { setQuery(''); setResults([]); }}
                >
                  <Ionicons name="close-circle" size={14} color={Colors.surface[150]} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* ── Divider ──────────────────────────────────────────── */}
          <View style={s.divider} />

          {/* ── Results or caption ───────────────────────────────── */}
          {showResults ? (
            // Figma node 189:446 "indexing city results" — h:130, py:8, gap:20
            <View style={s.resultsWrapper}>
              <ScrollView
                style={s.resultsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                onScroll={handleScroll}
                scrollEventThrottle={32}
                onContentSizeChange={(_, h) => setContentH(h)}
              >
                <View style={s.resultsContent}>
                  {results.map((r, i) => (
                    <ResultRow
                      key={`${r.lat}-${r.lon}-${i}`}
                      result={r}
                      query={query}
                      onPress={() => handleSelect(r)}
                    />
                  ))}
                </View>
              </ScrollView>

              {/* Figma 144:467 — 2×35 #d9d9d9 pill at right edge */}
              <CustomScrollbar
                contentH={contentH}
                containerH={RESULTS_MAX_H}
                scrollY={scrollY}
              />
            </View>
          ) : (
            // Figma node 179:284 "instructions caption" — py:8
            <View style={s.captionRow}>
              <Text style={s.caption}>
                search for a city to see what the weather is like there
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.surface[100] },
  webview: { flex: 1 },

  // ── Header — Figma 185:347 ────────────────────────────────────────────────
  // glass-linear gradient: transparent (top) → solid surface-100 (bottom)
  // glass-bg radius:12 — simulated with a 3-stop gradient ramp
  // justify-end: progress + title pin to the opaque bottom of the pane
  // border-b: hairline at the bottom separates header from map
  header: {
    position:           'absolute',
    top: 0, left: 0, right: 0,
    height:             133,
    paddingHorizontal:  20,
    paddingBottom:      20,
    justifyContent:     'flex-end',   // Figma: justify-end
    gap:                24,
    // Figma: border-b surface-100 (subtle separator)
    borderBottomWidth:  StyleSheet.hairlineWidth,
    borderBottomColor:  Colors.surface[100],
    zIndex:             10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip:      { ...Typography.caption, color: Colors.surface[150] },
  title:     { ...Typography.titleLg, color: Colors.surface[200] },

  // ── Progress dots — Figma: 9×9 circles, gap:3 ────────────────────────────
  dots:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:    { width: 9, height: 9, borderRadius: 5 },
  dotOn:  { backgroundColor: Colors.surface[200] },
  dotOff: { backgroundColor: 'rgba(43,30,30,0.18)' },

  // ── Search Container (card) ───────────────────────────────────────────────
  // Figma: left:0, width:393, radius:16, border:surface-100, overflow:hidden
  card: {
    position:     'absolute',
    left:         0,
    right:        0,
    borderRadius: 16,
    // Bright border — crisp specular edge, matches weather card
    borderWidth:  StyleSheet.hairlineWidth,
    borderColor:  'rgba(255,255,255,0.88)',
    overflow:     'hidden',
    zIndex:       20,
    // Soft lift shadow
    shadowColor:     '#1d1d1d',
    shadowOffset:    { width: 0, height: -3 },
    shadowOpacity:   0.07,
    shadowRadius:    18,
    elevation:       10,
  },
  // glass-linear base — gradient handled by LinearGradient in JSX.
  // borderRadius clips the gradient to the card shape.
  glassBase: {
    borderRadius: 16,
  },
  // Specular shine — bright white gradient covering top 64 px of the card
  glossShine: {
    position: 'absolute',
    top:      0,
    left:     0,
    right:    0,
    height:   64,
    zIndex:   1,
  },
  // 1.5 px solid white rim — sharpest light catch at the very top edge
  glassRim: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1.5,
    backgroundColor: 'rgba(255,255,255,1.0)',
    zIndex:          2,
  },
  // Inner content — Figma padding: px-24, py-12 (idle) / p-24 (focused)
  inner: {
    padding: 20,   // Figma inner container is 353px = 393 - 20*2
    gap:     16,
  },

  // ── Top group: location btn + search bar, gap:12 ─────────────────────────
  topGroup: { gap: 12 },

  // Location button — Figma: px-16, py-8, radius:20, gap:10
  locationRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:    20,
  },
  locationText: { ...Typography.caption, color: Colors.surface[150] },

  // Search bar — Figma: px-16, py-8, radius:200, border:surface-100
  // Idle: gradient bg (surface-100 → transparent, bottom→top)
  // Active: solid surface-100 bg
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    height:            32,
    paddingHorizontal: 16,
    borderRadius:      200,
    borderWidth:       1,
    borderColor:       Colors.surface[100],
    backgroundColor:   'rgba(245,244,244,0.45)',   // idle: slightly transparent
  },
  searchBarActive: {
    backgroundColor: Colors.surface[100],          // active: solid fill
    borderColor:     Colors.surface[100],
  },
  searchInput: {
    flex:          1,
    fontFamily:    'PublicSans_400Regular',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[200],
    padding:       0,
    margin:        0,
  },

  // ── Divider — Figma: hairline, surface-200 @ 20% opacity ─────────────────
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface[200],
    opacity:         0.2,
  },

  // ── Caption — Figma node 179:284, fontSize:10, py:8 ─────────────────────
  captionRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  caption: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[150],
    textAlign:     'center',
  },

  // ── Results — Figma 189:446 "indexing city results": h:130, py:8, gap:20 ─
  resultsWrapper: {
    flexDirection: 'row',
    maxHeight:     RESULTS_MAX_H,
  },
  resultsList: { flex: 1 },
  resultsContent: {
    paddingVertical: 8,
    gap:             20,
  },

  // Result row — Figma 197:454: gap:14 between icon and text
  resultRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           14,
  },
  resultIcon: { flexShrink: 0 },
  // Muted portion of the label
  resultDim: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[30],   // #5b5a5a
    flexShrink:    1,
  },
  // Matched (typed) portion of the label
  resultMatch: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         '#1e1e1e',            // Figma: near-black for the match
  },

  // ── Custom scrollbar — Figma 144:467: w:2, h:35, #d9d9d9, radius:100 ────
  scrollTrack: {
    width:          10,   // wider tap target; visual thumb is 2px
    justifyContent: 'flex-start',
    alignItems:     'center',
    paddingVertical: 4,
  },
  scrollThumb: {
    position:        'absolute',
    width:           2,
    height:          THUMB_H,
    borderRadius:    100,
    backgroundColor: '#d9d9d9',
  },
});
