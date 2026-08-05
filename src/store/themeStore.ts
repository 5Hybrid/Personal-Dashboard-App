import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system" | "futuristic";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// localStorage (not the SQLite `preference` table) so index.html's inline
// no-flash script can read it synchronously before React — and before any
// Tauri IPC round-trip — ever runs.
export const THEME_STORAGE_KEY = "life-os-theme";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);
