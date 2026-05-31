import { create } from "zustand";
import { ClothingItem } from "./closetStore";

export type OutfitSuggestion = {
  items: ClothingItem[];
  reason: string; // Claude's explanation e.g. "Light layers for 18°C and partly cloudy"
};

type OutfitStore = {
  dayPlans: string; // user's plans for the day
  suggestions: OutfitSuggestion[];
  isLoading: boolean;
  setDayPlans: (plans: string) => void;
  setSuggestions: (suggestions: OutfitSuggestion[]) => void;
  setLoading: (loading: boolean) => void;
};

export const useOutfitStore = create<OutfitStore>((set) => ({
  dayPlans: "",
  suggestions: [],
  isLoading: false,
  setDayPlans: (dayPlans) => set({ dayPlans }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setLoading: (isLoading) => set({ isLoading }),
}));
