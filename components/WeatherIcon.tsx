/**
 * WeatherIcon
 *
 * Maps an OpenWeatherMap condition code to the correct Figma-exported asset.
 * Three icon types from Figma (node 308:26573 "current hourly weather scroll"):
 *   • sunny      — code 800 (clear)               → sunny.png (30×30 in 1x)
 *   • cloudy     — codes 801-804, 700-799          → cloudy.png (53×30 in 1x, aspect 73:41)
 *   • rain-cloud — codes 200-599 (rain/storm/drizzle) → cloudy.png + rain-drops.png overlay
 *   • snow       — codes 600-699                   → cloudy.png (no dedicated snow asset yet)
 *
 * All assets are local requires — no remote URLs.
 */

import { View, Image, StyleSheet } from 'react-native';

// ─── Local asset map (exported, not Figma CDN links) ─────────────────────────
export const WeatherAssets = {
  sunny:     require('@/assets/images/weather/sunny.png'),
  cloudy:    require('@/assets/images/weather/cloudy.png'),
  rainDrops: require('@/assets/images/weather/rain-drops.png'),
} as const;

// ─── Condition code → icon type ───────────────────────────────────────────────
export type WeatherIconType = 'sunny' | 'cloudy' | 'rain';

export function conditionToIconType(code: number): WeatherIconType {
  if (code === 800)                    return 'sunny';
  if (code >= 200 && code < 600)       return 'rain';   // thunderstorm, drizzle, rain
  return 'cloudy';                                       // clouds, atmosphere, snow → cloudy
}

// ─── Sizes (matching Figma 1x spec, React Native scales for device density) ──
const SUNNY_SIZE  = 30;                         // 30×30 circle
const CLOUDY_W    = 53;                         // 53px wide, aspect 73:41
const CLOUDY_H    = Math.round(53 * (41 / 73)); // = 30px

// The rain composite stacks rain-drops below the cloud, both centred horizontally.
// Figma: cloud h=18.9, rain-drops h=16.3, cloud y=0, rain y=13.7 (partial overlap)
const RAIN_CLOUD_W = 34;
const RAIN_CLOUD_H = 19;
const RAIN_DROP_W  = 27;
const RAIN_DROP_H  = 16;
const RAIN_DROP_OFFSET_Y = 14; // how far down rain drops sit relative to cloud top

interface Props {
  conditionCode: number;
  /** Scale multiplier — default 1. Use 1.3 for the "current weather" large display. */
  scale?: number;
}

export default function WeatherIcon({ conditionCode, scale = 1 }: Props) {
  const type = conditionToIconType(conditionCode);
  const s    = scale;

  if (type === 'sunny') {
    return (
      <Image
        source={WeatherAssets.sunny}
        style={{ width: SUNNY_SIZE * s, height: SUNNY_SIZE * s }}
        resizeMode="contain"
      />
    );
  }

  if (type === 'rain') {
    // Composite: cloud sits on top, rain drops partially overlap underneath
    const totalH = (RAIN_DROP_OFFSET_Y + RAIN_DROP_H) * s;
    return (
      <View style={{ width: RAIN_CLOUD_W * s, height: totalH }}>
        {/* Cloud layer */}
        <Image
          source={WeatherAssets.cloudy}
          style={[
            StyleSheet.absoluteFill,
            {
              width:  RAIN_CLOUD_W * s,
              height: RAIN_CLOUD_H * s,
              top: 0,
            },
          ]}
          resizeMode="contain"
        />
        {/* Rain-drop layer — offset down so they peek below the cloud */}
        <Image
          source={WeatherAssets.rainDrops}
          style={{
            position: 'absolute',
            top:   RAIN_DROP_OFFSET_Y * s,
            left:  ((RAIN_CLOUD_W - RAIN_DROP_W) / 2) * s,
            width:  RAIN_DROP_W * s,
            height: RAIN_DROP_H * s,
          }}
          resizeMode="contain"
        />
      </View>
    );
  }

  // cloudy (default)
  return (
    <Image
      source={WeatherAssets.cloudy}
      style={{ width: CLOUDY_W * s, height: CLOUDY_H * s }}
      resizeMode="contain"
    />
  );
}
