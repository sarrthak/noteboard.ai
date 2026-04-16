import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActivityItem {
  id: string;
  message: string;
  href: string;
  createdAt: string;
}

interface ActivityState {
  items: ActivityItem[];
  logActivity: (entry: Omit<ActivityItem, "id" | "createdAt">) => void;
  clearActivity: () => void;
}

const MAX_ITEMS = 30;

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      items: [],
      logActivity: (entry) =>
        set((state) => ({
          items: [
            {
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              ...entry,
            },
            ...state.items,
          ].slice(0, MAX_ITEMS),
        })),
      clearActivity: () => set({ items: [] }),
    }),
    {
      name: "activity-storage",
    }
  )
);
