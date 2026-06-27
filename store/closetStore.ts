import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ClothingTags } from "@/lib/claude";

export type { ClothingTags };

export type ClothingItem = {
  id: string;
  imageUrl: string;
  /** Supabase Storage path — present for cloud-synced items, undefined for local-only. */
  storagePath?: string;
  category: "top" | "bottom" | "shoes" | "accessory" | "outerwear";
  /** Structured tags from auto-tagger (type, styles, colour). Editable from closet view. */
  clothingTags?: ClothingTags;
  /** Flat tag array for Claude outfit recommendation prompts. */
  tags: string[];
  createdAt: string;
};

type ClosetStore = {
  items: ClothingItem[];
  setItems: (items: ClothingItem[]) => void;
  addItem: (item: ClothingItem) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
};

export const useClosetStore = create<ClosetStore>()(
  persist(
    (set) => ({
      items: [],
      setItems: (items) => set({ items }),
      addItem:  (item)  => set((state) => ({
        // Deduplicate: replace if id already exists
        items: state.items.some((i) => i.id === item.id)
          ? state.items.map((i) => (i.id === item.id ? item : i))
          : [...state.items, item],
      })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      clearAll: () => set({ items: [] }),
    }),
    {
      name:    "whether-closet-v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
