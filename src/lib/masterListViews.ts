import { parseDateOnly, startOfDay } from "@/lib/calendarGrid";
import type { Item } from "@/types";

export interface SavedView {
  id: string;
  label: string;
  predicate: (item: Item) => boolean;
}

export function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null;
  // `parseDateOnly` builds local midnight from the y/m/d components directly
  // — `new Date(dueDate)` parses the bare "YYYY-MM-DD" as UTC midnight, which
  // silently lands a day early once re-expressed in local time for anyone
  // west of UTC (see calendarGrid.ts's header comment for the full story).
  const today = startOfDay(new Date());
  const due = parseDateOnly(dueDate);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export const SAVED_VIEWS: SavedView[] = [
  {
    id: "this-week",
    label: "This Week",
    predicate: (item) => {
      const days = daysUntil(item.due_date);
      return days !== null && days >= 0 && days <= 7;
    },
  },
  {
    id: "school-only",
    label: "School Only",
    predicate: (item) => item.category === "School",
  },
  {
    id: "overdue",
    label: "Overdue",
    predicate: (item) => {
      const days = daysUntil(item.due_date);
      return days !== null && days < 0 && item.status !== "Completed";
    },
  },
  {
    id: "high-priority",
    label: "High Priority",
    predicate: (item) => item.priority === "High",
  },
];
