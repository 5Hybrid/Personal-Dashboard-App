import type { ItemStatus } from "@/types";

// Shared by Master List and every per-class Assignments tab so clicking a
// status cycles it the same way everywhere in the app.
export const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Completed",
  Completed: "Not Started",
};
