// Open-Meteo weather helpers — free, no API key required
// Docs:        https://open-meteo.com/en/docs
// WMO codes:   https://open-meteo.com/en/docs#weathervariables
// Geocoding:   https://open-meteo.com/en/docs/geocoding-api

const GEO_URL  = 'https://geocoding-api.open-meteo.com/v1/search';
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

// ─── WMO weather code → human description ────────────────────────────────────
const WMO_DESCRIPTIONS: Record<number, string> = {
  0:  'Clear sky',
  1:  'Mainly clear',
  2:  'Partly cloudy',
  3:  'Overcast',
  45: 'Foggy',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight showers',
  81: 'Moderate showers',
  82: 'Violent showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
};

// ─── Geocode cache (module-level) ─────────────────────────────────────────────
// Both fetchCurrentWeather and fetchHourlyForecast are called in parallel
// (Promise.all in location-set.tsx). Caching avoids a duplicate geocoding call.
const _geoCache = new Map<string, { lat: number; lon: number }>();

async function geocodeCity(city: string): Promise<{ lat: number; lon: number }> {
  const key = city.trim().toLowerCase();
  if (_geoCache.has(key)) return _geoCache.get(key)!;

  const res = await fetch(
    `${GEO_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const d = await res.json();
  if (!d.results?.length) throw new Error(`City not found: ${city}`);

  const coords = { lat: d.results[0].latitude as number, lon: d.results[0].longitude as number };
  _geoCache.set(key, coords);
  return coords;
}

// ─── Time formatting ──────────────────────────────────────────────────────────
// isoTime: "2026-06-05T14:00" — already local time when timezone=auto is set
function formatISOHour(isoTime: string): string {
  const h = parseInt(isoTime.slice(11, 13), 10);
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// ─── Current weather ──────────────────────────────────────────────────────────
export async function fetchCurrentWeather(city: string) {
  const { lat, lon } = await geocodeCity(city);
  const res = await fetch(
    `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&wind_speed_unit=kmh&temperature_unit=celsius`,
  );
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const d = await res.json();
  const c = d.current;

  return {
    temp:          Math.round(c.temperature_2m)              as number,
    feelsLike:     Math.round(c.apparent_temperature)        as number,
    description:   WMO_DESCRIPTIONS[c.weather_code as number] ?? 'Unknown',
    windSpeed:     Math.round(c.wind_speed_10m * 10) / 10    as number, // km/h, 1 decimal
    conditionCode: c.weather_code                            as number,
  };
}

// ─── Hourly forecast (24 hours) ───────────────────────────────────────────────
// Open-Meteo returns times as ISO strings in local time when timezone=auto.
// The Figma annotation says "up to 24 hours"; we request exactly 24 slots.
export async function fetchHourlyForecast(city: string) {
  const { lat, lon } = await geocodeCity(city);
  const res = await fetch(
    `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weather_code` +
    `&timezone=auto&forecast_hours=24&temperature_unit=celsius`,
  );
  if (!res.ok) throw new Error(`Forecast fetch failed (${res.status})`);
  const d = await res.json();

  return (d.hourly.time as string[]).map((isoTime, i) => ({
    time:          formatISOHour(isoTime),
    temp:          Math.round(d.hourly.temperature_2m[i] as number),
    conditionCode: d.hourly.weather_code[i] as number,
  }));
}
