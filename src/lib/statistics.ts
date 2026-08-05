import { daysUntil } from "@/lib/masterListViews";
import type { Item } from "@/types";

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function completedCount(items: Item[]): number {
  return items.filter((i) => i.status === "Completed").length;
}

export function completionRate(items: Item[]): number {
  return items.length > 0 ? completedCount(items) / items.length : 0;
}

export function missedDeadlines(items: Item[]): number {
  return items.filter((i) => {
    const days = daysUntil(i.due_date);
    return days !== null && days < 0 && i.status !== "Completed";
  }).length;
}

// No dedicated `completed_at` field (see CompletionHeatmap) — `updated_at` is
// used as the completion-date proxy throughout this page for the same reason.
export function hoursStudied(items: Item[]): number {
  const minutes = items
    .filter((i) => i.category === "School" && i.status === "Completed")
    .reduce((sum, i) => sum + (i.estimated_duration ?? 0), 0);
  return minutes / 60;
}

export function completionsInLastNDays(items: Item[], days: number): number {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return items.filter((i) => i.status === "Completed" && new Date(i.updated_at) >= cutoff).length;
}

export function dailyCompletionTrend(items: Item[], days: number): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.status !== "Completed") continue;
    const key = dateKey(new Date(item.updated_at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    result.push({ date: dateKey(d), count: counts.get(dateKey(d)) ?? 0 });
  }
  return result;
}

// Consecutive days with a completed Gym Item, ending today — but if today's
// workout isn't logged yet, count back from yesterday instead of zeroing an
// otherwise-live streak (there's still time left today to extend it).
export function gymWorkoutStreak(items: Item[]): number {
  const completedGymDates = new Set(
    items
      .filter((i) => i.category === "Gym" && i.status === "Completed")
      .map((i) => dateKey(new Date(i.updated_at))),
  );

  const day = new Date();
  day.setHours(0, 0, 0, 0);
  if (!completedGymDates.has(dateKey(day))) {
    day.setDate(day.getDate() - 1);
  }

  let streak = 0;
  while (completedGymDates.has(dateKey(day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}
