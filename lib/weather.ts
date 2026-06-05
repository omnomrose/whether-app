// OpenWeatherMap API helpers
// Free tier: /weather (current) + /forecast (5-day / 3-hour intervals)
// Units: metric (°C, m/s). Wind speed converted to km/h before returning.

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY!;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// ─── Time formatting ──────────────────────────────────────────────────────────
// dt:       Unix UTC timestamp (seconds)
// tzOffset: city.timezone from /forecast — seconds east of UTC (may be negative)
function formatHour(dt: number, tzOffset: number): string {
  const h = ((Math.floor((dt + tzOffset) / 3600) % 24) + 24) % 24;
  if (h === 0)  return '12 AM';
  if (h < 12)   return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

// ─── Current weather ──────────────────────────────────────────────────────────
export async function fetchCurrentWeather(city: string) {
  const res = await fetch(
    `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`,
  );
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const d = await res.json();

  return {
    temp:          Math.round(d.main.temp)               as number,
    feelsLike:     Math.round(d.main.feels_like)         as number,
    description:   (d.weather[0].description as string),
    windSpeed:     Math.round(d.wind.speed * 3.6 * 10) / 10 as number, // m/s → km/h
    conditionCode: d.weather[0].id                       as number,
  };
}

// ─── 3-hour forecast ──────────────────────────────────────────────────────────
// cnt=40 = maximum 5-day / 3-hour slots.
// We return all of them so the hourly scroll can show as much as desired.
// The Figma annotation says "up to 24 hours"; the caller can slice if needed.
export async function fetchHourlyForecast(city: string) {
  const res = await fetch(
    `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&cnt=40`,
  );
  if (!res.ok) throw new Error(`Forecast fetch failed (${res.status})`);
  const d = await res.json();

  const tzOffset: number = d.city.timezone;

  return (d.list as {
    dt: number;
    main: { temp: number };
    weather: { id: number; description: string }[];
  }[]).map((item) => ({
    time:          formatHour(item.dt, tzOffset),
    temp:          Math.round(item.main.temp),
    conditionCode: item.weather[0].id,
  }));
}
