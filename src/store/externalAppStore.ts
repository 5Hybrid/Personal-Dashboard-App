import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ExternalAppUiState {
  expanded: boolean;
  hidden: boolean;
}

const DEFAULT_STATE: ExternalAppUiState = { expanded: false, hidden: false };

interface ExternalAppStoreState {
  apps: Record<string, ExternalAppUiState>;
  setExpanded: (id: string, expanded: boolean) => void;
  setHidden: (id: string, hidden: boolean) => void;
}

// Per-app UI layout state (expanded/hidden) — localStorage-backed like
// themeStore.ts, for the same reason: this is a pure UI-layout concern local
// to this machine's window, not app data worth putting in the SQLite
// `preference` table.
export const useExternalAppStore = create<ExternalAppStoreState>()(
  persist(
    (set) => ({
      apps: {},
      setExpanded: (id, expanded) =>
        set((state) => ({
          apps: { ...state.apps, [id]: { ...DEFAULT_STATE, ...state.apps[id], expanded } },
        })),
      setHidden: (id, hidden) =>
        set((state) => ({
          apps: { ...state.apps, [id]: { ...DEFAULT_STATE, ...state.apps[id], hidden } },
        })),
    }),
    { name: "life-os-external-apps" },
  ),
);

export function getAppUiState(apps: Record<string, ExternalAppUiState>, id: string): ExternalAppUiState {
  return apps[id] ?? DEFAULT_STATE;
}
