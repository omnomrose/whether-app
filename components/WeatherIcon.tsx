/**
 * WeatherIcon
 *
 * Maps a WMO weather code (Open-Meteo) to the correct Figma-exported asset.
 * Three icon types from Figma (node 308:26573 "current hourly weather scroll"):
 *   • sunny      — WMO 0–1 (clear / mainly clear)               → sunny.png (30×30 in 1x)
 *   • cloudy     — WMO 2–3, 45–48, 71–77, 85–86 (cloud/fog/snow) → cloudy.png (53×30 in 1x, aspect 73:41)
 *   • rain-cloud — WMO 51–65, 80–82, 95–99 (rain/showers/storm) → raincloud.png (34×30 in 1x)
 *
 * All assets are local requires — no remote URLs.
 */

import { Image } from 'react-native';

// ─── Local asset map (exported, not Figma CDN links) ─────────────────────────
export const WeatherAssets = {
  sunny:      require('@/assets/images/weather/sunny.png'),
  cloudy:     require('@/assets/images/weather/cloudy.png'),
  raincloud:  require('@/assets/images/weather/raincloud.png'),
} as const;

// ─── Condition code → icon type ───────────────────────────────────────────────
export type WeatherIconType = 'sunny' | 'cloudy' | 'rain';

export function conditionToIconType(code: number): WeatherIconType {
  // WMO codes — https://open-meteo.com/en/docs#weathervariables
  if (code <= 1)                                 return 'sunny';  // 0 clear, 1 mainly clear
  if (code >= 51 && code <= 65)                  return 'rain';   // drizzle + rain
  if (code >= 80 && code <= 82)                  return 'rain';   // rain showers
  if (code === 95 || code === 96 || code === 99) return 'rain';   // thunderstorm
  return 'cloudy'; // 2–3 partly/overcast, 45–48 fog, 71–77 snow, 85–86 snow showers
}

// ─── Sizes (matching Figma 1x spec, React Native scales for device density) ──
const SUNNY_SIZE  = 30;                          // 30×30 circle
const CLOUDY_W    = 53;                          // 53px wide, aspect 73:41
const CLOUDY_H    = Math.round(53 * (41 / 73)); // = 30px
// raincloud.png is 134×120px — displayed at proportional height 30: width = 30*(134/120) ≈ 34
const RAINCLOUD_W = 34;
const RAINCLOUD_H = 30;

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
    return (
      <Image
        source={WeatherAssets.raincloud}
        style={{ width: RAINCLOUD_W * s, height: RAINCLOUD_H * s }}
        resizeMode="contain"
      />
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
