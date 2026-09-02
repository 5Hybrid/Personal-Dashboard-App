import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

// localStorage, not the SQLite `preference` table — this is a per-device UI
// layout choice, not data that should follow the user across devices (see
// themeStore's SIDEBAR_STORAGE_KEY equivalent for the same reasoning).
export const SIDEBAR_STORAGE_KEY = "life-os-sidebar-collapsed";

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
    }),
    { name: SIDEBAR_STORAGE_KEY },
  ),
);
