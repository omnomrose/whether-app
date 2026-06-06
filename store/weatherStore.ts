import { create } from 'zustand';

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
  location: string | null;         // city name for API queries, e.g. "Vancouver"
  displayLocation: string | null;  // formatted label, e.g. "VANCOUVER, BRITISH COLUMBIA"
  weather: WeatherData;
  userName: string | null;
  setLocation: (city: string) => void;
  setDisplayLocation: (label: string) => void;
  setWeather: (data: WeatherData) => void;
  setUserName: (name: string) => void;
};

export const useWeatherStore = create<WeatherStore>((set) => ({
  location:        null,
  displayLocation: null,
  weather:         null,
  userName:        null,

  // Clear cached weather when location changes so the new screen always re-fetches.
  setLocation:        (location)        => set({ location, weather: null }),
  setDisplayLocation: (displayLocation) => set({ displayLocation }),
  setWeather:         (weather)         => set({ weather }),
  setUserName:        (userName)        => set({ userName }),
}));
