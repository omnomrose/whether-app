import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ClothingItem } from './closetStore';

export type OutfitSuggestion = {
  items:  ClothingItem[];
  reason: string;
};

export type CurrentOutfit = {
  top?:    ClothingItem;
  bottom?: ClothingItem;
  shoes?:  ClothingItem;
};

type OutfitStore = {
  dayPlans:      string;
  suggestions:   OutfitSuggestion[];
  isLoading:     boolean;
  currentOutfit: CurrentOutfit | null;
  setDayPlans:      (plans: string) => void;
  setSuggestions:   (suggestions: OutfitSuggestion[]) => void;
  setLoading:       (loading: boolean) => void;
  setCurrentOutfit: (outfit: CurrentOutfit | null) => void;
};

export const useOutfitStore = create<OutfitStore>()(
  persist(
    (set) => ({
      dayPlans:      '',
      suggestions:   [],
      isLoading:     false,
      currentOutfit: null,
      setDayPlans:      (dayPlans)      => set({ dayPlans }),
      setSuggestions:   (suggestions)   => set({ suggestions }),
      setLoading:       (isLoading)     => set({ isLoading }),
      setCurrentOutfit: (currentOutfit) => set({ currentOutfit }),
    }),
    {
      name:    'whether-outfit-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        dayPlans:      s.dayPlans,
        currentOutfit: s.currentOutfit,
      }),
    }
  )
);
