import { parseDateOnly } from "@/lib/calendarGrid";
import { daysUntil } from "@/lib/masterListViews";
import type { Item } from "@/types";

const PRIORITY_ORDER: Record<Item["priority"], number> = { High: 0, Medium: 1, Low: 2 };

function byPriority(a: Item, b: Item): number {
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

function incomplete(items: Item[]): Item[] {
  return items.filter((i) => i.status !== "Completed");
}

export function upcomingDeadlines(items: Item[]): Item[] {
  return incomplete(items)
    .filter((i) => {
      const days = daysUntil(i.due_date);
      return days !== null && days >= 2 && days <= 7;
    })
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : byPriority(a, b)));
}

export function todayTimeline(items: Item[]): Item[] {
  // Includes completed items — it's a picture of the whole day's schedule,
  // not a work-remaining list.
  return items
    .filter((i) => daysUntil(i.due_date) === 0)
    .sort((a, b) => (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99"));
}

// Short, relative label for a due date badge — "Today"/"Tomorrow"/"Overdue"
// read faster than a raw date at a glance, falling back to "MMM D" once it's
// far enough out that the relative framing stops being useful.
export function formatShortDue(dueDate: string | null): string {
  if (!dueDate) return "";
  const days = daysUntil(dueDate);
  if (days === null) return "";
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return parseDateOnly(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
