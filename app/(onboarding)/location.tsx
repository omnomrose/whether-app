// Onboarding — city/location picker
// Figma 144:45 (collapsed) + 144:456 / 189:435 (expanded)
// Frame: 393 × 852

import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  useWindowDimensions,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import WebView from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ExpoLocation from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ─── Figma constants ──────────────────────────────────────────────────────────
const FIGMA_H            = 852;
const CARD_TOP_COLLAPSED = 635;
const CARD_TOP_EXPANDED  = 265;
const CARD_WIDTH         = 353;
const CARD_LEFT          = 20;
// Results list constraints
const RESULTS_MAX_H      = 220;  // shows ~5 rows, scroll for remaining 2–7
const THUMB_H            = 35;   // Figma scrollbar thumb height
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shared animation config ──────────────────────────────────────────────────
const ANIM_CFG = {
  duration:        500,
  easing:          Easing.inOut(Easing.ease),
  useNativeDriver: false as const,
};
const LAYOUT_ANIM = {
  duration: 250,
  create:   { type: LayoutAnimation.Types.easeOut,     property: LayoutAnimation.Properties.opacity },
  update:   { type: LayoutAnimation.Types.easeInEaseOut },
  delete:   { type: LayoutAnimation.Types.easeIn,      property: LayoutAnimation.Properties.opacity },
};

// ─── Leaflet HTML ─────────────────────────────────────────────────────────────
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#f2efe9}
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
var map=L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true,renderer:L.canvas({padding:0.5}),zoomAnimation:true,markerZoomAnimation:true,fadeAnimation:true,dragging:true,touchZoom:true,doubleClickZoom:false,scrollWheelZoom:false,bounceAtZoomLimits:false,wheelDebounceTime:20,wheelPxPerZoomLevel:60}).setView([49.2827,-123.1207],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,minZoom:3,subdomains:'abc',detectRetina:true,keepBuffer:8,updateWhenIdle:true,updateWhenZooming:false,updateInterval:150,crossOrigin:true}).addTo(map);
function onMsg(e){try{var d=JSON.parse(e.data);if(d.type==='flyTo')map.flyTo([d.lat,d.lng],d.zoom||12,{animate:true,duration:0.9,easeLinearity:0.2});}catch(_){}}
window.addEventListener('message',onMsg);document.addEventListener('message',onMsg);
</script></body></html>`;

// ─── Nominatim ────────────────────────────────────────────────────────────────
type GeoResult = { display_name: string; lat: string; lon: string; address?: Record<string,string> };

async function searchCities(q: string): Promise<GeoResult[]> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1&accept-language=en`,
      { headers: { 'User-Agent': 'whether-app/1.0' } }
    );
    const data = await res.json() as GeoResult[];
    const seen = new Set<string>();
    const out: GeoResult[] = [];
    for (const r of data) {
      const key = (r.address?.city || r.address?.town || r.display_name.split(',')[0]) + '|' + (r.address?.country || '');
      if (!seen.has(key)) { seen.add(key); out.push(r); }
      if (out.length === 7) break;
    }
    return out;
  } catch { return []; }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'User-Agent': 'whether-app/1.0' } }
    );
    const d = await res.json();
    return d.address?.city || d.address?.town || d.address?.municipality || 'Current Location';
  } catch { return 'Current Location'; }
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
// Figma: w-2, h-35, bg-#d9d9d9, rounded-100 — positioned at right edge of card
function CustomScrollbar({
  contentH,
  containerH,
  scrollY,
}: {
  contentH:   number;
  containerH: number;
  scrollY:    Animated.Value;
}) {
  const maxScroll = Math.max(contentH - containerH, 1);
  const trackH    = containerH - THUMB_H;
  const thumbTop  = scrollY.interpolate({
    inputRange:  [0, maxScroll],
    outputRange: [0, Math.max(trackH, 0)],
    extrapolate: 'clamp',
  });

  if (contentH <= containerH) return null; // no overflow → hide bar

  return (
    <View style={[s.scrollTrack, { height: containerH }]}>
      <Animated.View style={[s.scrollThumb, { top: thumbTop }]} />
    </View>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────
function ResultRow({ result, query, onPress }: { result: GeoResult; query: string; onPress: () => void }) {
  const label   = result.display_name.split(',').slice(0, 2).join(',').toUpperCase().trim();
  const queryUC = query.toUpperCase().trim();
  const idx     = label.indexOf(queryUC);

  return (
    <Pressable style={s.resultRow} onPress={onPress}>
      <View style={s.resultIcon} />
      {idx === -1 ? (
        <Text style={s.resultDim} numberOfLines={1}>{label}</Text>
      ) : (
        <Text style={s.resultDim} numberOfLines={1}>
          {idx > 0 && <Text style={s.resultDim}>{label.slice(0, idx)}</Text>}
          <Text style={s.resultMatch}>{label.slice(idx, idx + queryUC.length)}</Text>
          {idx + queryUC.length < label.length &&
            <Text style={s.resultDim}>{label.slice(idx + queryUC.length)}</Text>}
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

  const webRef        = useRef<WebView>(null);
  const inputRef      = useRef<TextInput>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout>>();
  const scrollYRef    = useRef(new Animated.Value(0)).current;
  // Guards: prevent double-dismiss when keyboardDidHide fires after handleSelect
  const dismissingRef = useRef(false);
  const searchingRef  = useRef(false); // mirror of isSearching for listener callback

  const insets                  = useSafeAreaInsets();
  const { width: screenW, height } = useWindowDimensions();

  const collapsedTop = (CARD_TOP_COLLAPSED / FIGMA_H) * height;
  const expandedTop  = (CARD_TOP_EXPANDED  / FIGMA_H) * height;

  // Three animated values: top, left, width
  const cardTop   = useRef(new Animated.Value(collapsedTop)).current;
  const cardLeft  = useRef(new Animated.Value(CARD_LEFT)).current;
  const cardWidth = useRef(new Animated.Value(CARD_WIDTH)).current;

  // Sync animated values if screen height changes (rare — rotation, etc.)
  useEffect(() => {
    if (!isSearching) {
      cardTop.setValue(collapsedTop);
      cardLeft.setValue(CARD_LEFT);
      cardWidth.setValue(CARD_WIDTH);
    }
  }, [collapsedTop]);

  // Collapse the card whenever the keyboard is fully hidden.
  // This fires after: user swipes keyboard down, taps "done",
  // or our own Keyboard.dismiss() inside handleSelect / handleCurrentLocation.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (searchingRef.current && !dismissingRef.current) {
        dismissSearch();
      }
    });
    return () => sub.remove();
  }, []);

  const flyTo = (lat: number, lng: number, zoom = 12) =>
    webRef.current?.injectJavaScript(
      `map.flyTo([${lat},${lng}],${zoom},{animate:true,duration:0.9,easeLinearity:0.2});true;`
    );

  // ── Animate expand / collapse ──────────────────────────────────────────
  const expandCard = () =>
    Animated.parallel([
      Animated.timing(cardTop,   { toValue: expandedTop, ...ANIM_CFG }),
      Animated.timing(cardLeft,  { toValue: 0,           ...ANIM_CFG }),
      Animated.timing(cardWidth, { toValue: screenW,     ...ANIM_CFG }),
    ]).start();

  const collapseCard = () =>
    Animated.parallel([
      Animated.timing(cardTop,   { toValue: collapsedTop, ...ANIM_CFG }),
      Animated.timing(cardLeft,  { toValue: CARD_LEFT,    ...ANIM_CFG }),
      Animated.timing(cardWidth, { toValue: CARD_WIDTH,   ...ANIM_CFG }),
    ]).start();

  const handleFocus = () => {
    searchingRef.current = true;
    setIsSearching(true);
    expandCard();
  };

  const dismissSearch = () => {
    if (dismissingRef.current) return;   // already mid-dismiss, ignore re-entry
    dismissingRef.current = true;
    searchingRef.current  = false;
    setIsSearching(false);
    collapseCard();
    // Clear results after the card has returned to resting position
    setTimeout(() => {
      setResults([]);
      dismissingRef.current = false;
    }, 520);
  };

  // ── Autocomplete ────────────────────────────────────────────────────────
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchCities(text);
      setResults(r);
      setLoading(false);
    }, 280);
  };

  const handleSelect = (result: GeoResult) => {
    flyTo(parseFloat(result.lat), parseFloat(result.lon));
    setQuery(result.display_name.split(',')[0]);
    dismissSearch();
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
    dismissSearch();
    const pos  = await ExpoLocation.getCurrentPositionAsync({});
    flyTo(pos.coords.latitude, pos.coords.longitude, 13);
    const name = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
    setQuery(name);
    setLoading(false);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.setValue(e.nativeEvent.contentOffset.y);
  };

  return (
    <View style={s.root}>

      {/* ── Map ──────────────────────────────────────────────── */}
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

      {/* ── Header ───────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerRow}>
          <ProgressDots step={2} total={4} />
          <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={12}>
            <Text style={s.skip}>skip</Text>
          </Pressable>
        </View>
        <Text style={s.title}>Which city are you based in?</Text>
      </View>

      {/* ── Animated card ────────────────────────────────────── */}
      <Animated.View
        style={[
          s.card,
          { top: cardTop, left: cardLeft, width: cardWidth },
        ]}
      >
        <View style={s.inner}>

          {/* Top group: search bar + location — gap 12 */}
          <View style={s.topGroup}>
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
                  onPress={() => {
                    setQuery('');
                    setResults([]);
                  }}
                >
                  <Ionicons name="close-circle" size={14} color={Colors.surface[150]} />
                </Pressable>
              ) : null}
            </View>

            <Pressable style={s.locationRow} onPress={handleCurrentLocation}>
              <Ionicons name="location-sharp" size={16} color={Colors.surface[200]} />
              <Text style={s.locationText}>USE CURRENT LOCATION</Text>
            </Pressable>
          </View>

          {/* Bottom group: divider + results / caption — gap 8 */}
          <View style={s.bottomGroup}>
            <View style={s.divider} />

            {isSearching && results.length > 0 ? (
              /* Results + custom scrollbar */
              <View style={s.resultsWrapper}>
                <ScrollView
                  style={s.resultsList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
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

                {/* Custom scrollbar — Figma: 2×35 #d9d9d9 pill */}
                <CustomScrollbar
                  contentH={contentH}
                  containerH={RESULTS_MAX_H}
                  scrollY={scrollYRef}
                />
              </View>
            ) : (
              <View style={s.captionRow}>
                <Text style={s.caption}>
                  search for a city to see what the weather is like there
                </Text>
              </View>
            )}
          </View>

        </View>
      </Animated.View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.surface[100] },
  webview: { flex: 1 },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    position:          'absolute',
    top:               0, left: 0, right: 0,
    backgroundColor:   Colors.surface[100],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.surface[200],
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               24,
    zIndex:            10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip:  { ...Typography.caption, color: Colors.surface[150] },
  title: { ...Typography.titleLg, color: Colors.surface[200] },

  // ── Progress dots ─────────────────────────────────────────────────────────
  dots:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  dot:    { width: 9, height: 9, borderRadius: 4.5 },
  dotOn:  { backgroundColor: Colors.surface[200] },
  dotOff: { backgroundColor: 'rgba(43,30,30,0.18)' },

  // ── Card ─────────────────────────────────────────────────────────────────
  card: {
    position:        'absolute',
    backgroundColor: Colors.surface[100],
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.surface[10],
    padding:         24,
    shadowColor:     '#1d1d1d',
    shadowOffset:    { width: 0, height: 13 },
    shadowOpacity:   0.05,
    shadowRadius:    14,
    elevation:       6,
    zIndex:          20,
  },
  inner:       { gap: 8 },
  topGroup:    { gap: 12 },   // Figma: spacing/2 = 12px
  bottomGroup: { gap: 8 },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    height:            31,
    paddingHorizontal: 16,
    borderRadius:      200,
    borderWidth:       1,
    borderColor:       Colors.surface[10],
    backgroundColor:   'rgba(245,244,244,0.5)',
  },
  searchBarActive: { borderColor: Colors.surface[200] },
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

  // ── Location row ──────────────────────────────────────────────────────────
  locationRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      20,
  },
  locationText: { ...Typography.caption, color: Colors.surface[200] },

  // ── Divider ───────────────────────────────────────────────────────────────
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: Colors.surface[200],
    opacity:         0.2,
  },

  // ── Caption ───────────────────────────────────────────────────────────────
  captionRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  caption: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      10,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[150],
    textAlign:     'center',
  },

  // ── Results ───────────────────────────────────────────────────────────────
  // Outer wrapper holds ScrollView + custom scrollbar side by side
  resultsWrapper: {
    flexDirection: 'row',
    maxHeight:     RESULTS_MAX_H,
  },
  resultsList:    { flex: 1 },
  resultsContent: { paddingVertical: 8, gap: 20 },

  // Figma 197:454 — px-16, gap-14, icon 15×15
  resultRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               14,
    paddingHorizontal: 16,
  },
  resultIcon: {
    width: 15, height: 15,
    backgroundColor: '#d9d9d9',
    flexShrink: 0,
  },
  resultDim: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[30],
    flexShrink:    1,
  },
  resultMatch: {
    fontFamily:    'PublicSans_400Regular',
    fontSize:      12,
    lineHeight:    16,
    letterSpacing: -0.18,
    color:         Colors.surface[200],
  },

  // ── Custom scrollbar — Figma: 2×35 #d9d9d9 pill ──────────────────────────
  scrollTrack: {
    width:         8,           // tap-friendly width; visual bar is 2px via thumb
    justifyContent:'flex-start',
    alignItems:    'center',
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
