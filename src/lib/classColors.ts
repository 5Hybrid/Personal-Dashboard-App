import type { ItemStatus } from "@/types";

// A user-chosen pastel theme per Context (stored in Context.color as one of
// these keys, not a raw hex — Tailwind's v4 scanner needs literal class names
// present in source to generate the CSS, so every shade actually used has to
// be spelled out in the lookup tables below rather than built from a
// template string like `bg-${hue}-100`.
export const CLASS_COLOR_KEYS = [
  "rose",
  "orange",
  "amber",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "blue",
  "violet",
  "pink",
] as const;

export type ClassColorKey = (typeof CLASS_COLOR_KEYS)[number];

export function isClassColorKey(value: string | null | undefined): value is ClassColorKey {
  return !!value && (CLASS_COLOR_KEYS as readonly string[]).includes(value);
}

// Swatch shown in the color picker.
export const CLASS_COLOR_SWATCH_CLASS: Record<ClassColorKey, string> = {
  rose: "bg-rose-300",
  orange: "bg-orange-300",
  amber: "bg-amber-300",
  lime: "bg-lime-300",
  emerald: "bg-emerald-300",
  teal: "bg-teal-300",
  cyan: "bg-cyan-300",
  blue: "bg-blue-300",
  violet: "bg-violet-300",
  pink: "bg-pink-300",
};

// "Not Started" — the full class theme.
const NOT_STARTED_ROW_CLASS: Record<ClassColorKey, string> = {
  rose: "bg-rose-100 dark:bg-rose-950/40",
  orange: "bg-orange-100 dark:bg-orange-950/40",
  amber: "bg-amber-100 dark:bg-amber-950/40",
  lime: "bg-lime-100 dark:bg-lime-950/40",
  emerald: "bg-emerald-100 dark:bg-emerald-950/40",
  teal: "bg-teal-100 dark:bg-teal-950/40",
  cyan: "bg-cyan-100 dark:bg-cyan-950/40",
  blue: "bg-blue-100 dark:bg-blue-950/40",
  violet: "bg-violet-100 dark:bg-violet-950/40",
  pink: "bg-pink-100 dark:bg-pink-950/40",
};

// "In Progress" — a visibly lighter tint of the same theme.
const IN_PROGRESS_ROW_CLASS: Record<ClassColorKey, string> = {
  rose: "bg-rose-50 dark:bg-rose-950/15",
  orange: "bg-orange-50 dark:bg-orange-950/15",
  amber: "bg-amber-50 dark:bg-amber-950/15",
  lime: "bg-lime-50 dark:bg-lime-950/15",
  emerald: "bg-emerald-50 dark:bg-emerald-950/15",
  teal: "bg-teal-50 dark:bg-teal-950/15",
  cyan: "bg-cyan-50 dark:bg-cyan-950/15",
  blue: "bg-blue-50 dark:bg-blue-950/15",
  violet: "bg-violet-50 dark:bg-violet-950/15",
  pink: "bg-pink-50 dark:bg-pink-950/15",
};

// "Completed" — always gray, regardless of the class's theme, per spec.
const COMPLETED_ROW_CLASS = "bg-muted/40";
export const COMPLETED_TEXT_CLASS = "line-through text-muted-foreground";

/** Row/cell background for an assignment given its class's color key (if any) and status. */
export function assignmentRowClass(colorKey: string | null | undefined, status: ItemStatus): string {
  if (status === "Completed") return COMPLETED_ROW_CLASS;
  if (!isClassColorKey(colorKey)) return "";
  return status === "In Progress" ? IN_PROGRESS_ROW_CLASS[colorKey] : NOT_STARTED_ROW_CLASS[colorKey];
}
