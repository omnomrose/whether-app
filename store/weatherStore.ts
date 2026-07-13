import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HourlyItem = {
  time: string;        // "10 AM", "3 PM"
  temp: number;
  conditionCode: number;
};

export type WeatherData = {
  temp: number;
  feelsLike: number;
  description: string;
  windSpeed: number;   // km/h (1 decimal)
  conditionCode: number;
  hourly: HourlyItem[];
} | null;

type WeatherStore = {
  location:        string | null;   // city name for API, e.g. "Vancouver"
  displayLocation: string | null;   // formatted label, e.g. "VANCOUVER, BC"
  weather:         WeatherData;
  lastFetched:     number | null;   // Date.now() of last successful fetch
  userName:        string | null;
  setLocation:        (city: string) => void;
  setDisplayLocation: (label: string) => void;
  setWeather:         (data: WeatherData, ts?: number) => void;
  setUserName:        (name: string) => void;
};

export const useWeatherStore = create<WeatherStore>()(
  persist(
    (set) => ({
      location:        null,
      displayLocation: null,
      weather:         null,
      lastFetched:     null,
      userName:        null,

      // Clear cached weather when location changes so a fresh fetch always runs.
      setLocation: (location) => set({ location, weather: null, lastFetched: null }),
      setDisplayLocation: (displayLocation) => set({ displayLocation }),
      setWeather: (weather, ts) =>
        set({ weather, lastFetched: ts ?? Date.now() }),
      setUserName: (userName) => set({ userName }),
    }),
    {
      name:    'whether-weather-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist location + display label + weather + timestamp; not loading flags.
      partialize: (s) => ({
        location:        s.location,
        displayLocation: s.displayLocation,
        weather:         s.weather,
        lastFetched:     s.lastFetched,
        userName:        s.userName,
      }),
    }
  )
);
