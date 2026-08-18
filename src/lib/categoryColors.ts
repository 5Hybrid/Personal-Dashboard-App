import type { Category } from "@/types";

// Soft/pastel per-category colors for scanability in mixed-category lists
// (Master List, Dashboard widgets) — decorative badges, not chart data marks,
// so a fixed, deliberately-chosen order matters more here than CVD-grade hue
// separation (the category name is always shown alongside the color).
export const CATEGORY_COLORS: Record<Category, string> = {
  School: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  Work: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  Gym: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  Personal: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  Finance: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  Projects: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  Relationships: "bg-pink-100 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  Health: "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
  Travel: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  Custom: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
};

// A solid dot/border reads better than a full CATEGORY_COLORS pill at small
// sizes (calendar cells, schedule rows) — same category order and hues as
// above, just a saturated single color instead of a soft badge pair.
export const CATEGORY_DOT_CLASS: Record<Category, string> = {
  School: "bg-blue-500",
  Work: "bg-amber-500",
  Gym: "bg-emerald-500",
  Personal: "bg-violet-500",
  Finance: "bg-rose-500",
  Projects: "bg-cyan-500",
  Relationships: "bg-pink-500",
  Health: "bg-teal-500",
  Travel: "bg-orange-500",
  Custom: "bg-slate-500",
};

export const CATEGORY_BORDER_CLASS: Record<Category, string> = {
  School: "border-blue-500",
  Work: "border-amber-500",
  Gym: "border-emerald-500",
  Personal: "border-violet-500",
  Finance: "border-rose-500",
  Projects: "border-cyan-500",
  Relationships: "border-pink-500",
  Health: "border-teal-500",
  Travel: "border-orange-500",
  Custom: "border-slate-500",
};

// Same category → hue mapping as CATEGORY_DOT_CLASS, as literal hex instead
// of a Tailwind class — for contexts (SVG stroke/fill, canvas) that can't
// consume a `bg-*` utility class. Tailwind's default v4 500-shade values.
export const CATEGORY_HEX: Record<Category, string> = {
  School: "#3b82f6",
  Work: "#f59e0b",
  Gym: "#10b981",
  Personal: "#8b5cf6",
  Finance: "#f43f5e",
  Projects: "#06b6d4",
  Relationships: "#ec4899",
  Health: "#14b8a6",
  Travel: "#f97316",
  Custom: "#64748b",
};
