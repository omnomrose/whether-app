import { create } from "zustand";

type WeatherData = {
  temp: number;
  feelsLike: number;
  description: string;
  hourly: { time: string; temp: number }[];
} | null;

type WeatherStore = {
  location: string | null;
  weather: WeatherData;
  setLocation: (location: string) => void;
  setWeather: (data: WeatherData) => void;
};

export const useWeatherStore = create<WeatherStore>((set) => ({
  location: null,
  weather: null,
  setLocation: (location) => set({ location }),
  setWeather: (weather) => set({ weather }),
}));
