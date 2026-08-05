import { create } from "zustand";

export type GroupBy = "none" | "category" | "status";

interface MasterListState {
  activeViewId: string | null;
  search: string;
  groupBy: GroupBy;
  setActiveView: (id: string) => void;
  setSearch: (search: string) => void;
  setGroupBy: (groupBy: GroupBy) => void;
}

export const useMasterListStore = create<MasterListState>((set) => ({
  activeViewId: null,
  search: "",
  groupBy: "none",
  setActiveView: (id) =>
    set((state) => ({ activeViewId: state.activeViewId === id ? null : id })),
  setSearch: (search) => set({ search }),
  setGroupBy: (groupBy) => set({ groupBy }),
}));
