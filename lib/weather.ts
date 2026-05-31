// OpenWeatherMap API helpers

const API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY!;
const BASE_URL = "https://api.openweathermap.org/data/2.5";

export async function fetchCurrentWeather(city: string) {
  const res = await fetch(
    `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
  );
  if (!res.ok) throw new Error("Failed to fetch weather");
  return res.json();
}

export async function fetchHourlyForecast(city: string) {
  const res = await fetch(
    `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&cnt=8`
  );
  if (!res.ok) throw new Error("Failed to fetch forecast");
  return res.json();
}
