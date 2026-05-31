import { create } from "zustand";

export type ClothingItem = {
  id: string;
  imageUrl: string;
  category: "top" | "bottom" | "shoes" | "accessory" | "outerwear";
  tags: string[]; // auto-tagged by Claude vision (e.g. "cotton", "casual", "blue")
  createdAt: string;
};

type ClosetStore = {
  items: ClothingItem[];
  setItems: (items: ClothingItem[]) => void;
  addItem: (item: ClothingItem) => void;
  removeItem: (id: string) => void;
};

export const useClosetStore = create<ClosetStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
}));
