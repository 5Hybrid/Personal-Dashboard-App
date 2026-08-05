import * as chrono from "chrono-node";
import { CONTEXT_TYPE_TO_CATEGORY } from "@/lib/categoryContext";
import type { Category, Context } from "@/types";

// Keyword signals for the free-text categories (and Work/Gym/School sessions
// that aren't tied to a specific named Context). Deliberately small — this is
// a confidence *signal*, not a classifier; anything it can't match falls
// through to Inbox rather than guessing.
const CATEGORY_KEYWORDS: Partial<Record<Category, string[]>> = {
  School: ["assignment", "homework", "exam", "quiz", "lecture", "study"],
  Work: ["meeting", "shift", "deadline", "client", "report"],
  Gym: ["workout", "gym", "run", "lift", "training", "exercise"],
  Personal: ["appointment", "errand", "birthday"],
  Finance: ["bill", "invoice", "pay", "payment", "rent", "tax"],
  Relationships: ["call", "dinner", "visit"],
  Health: ["doctor", "dentist", "checkup", "therapy", "medication"],
  Travel: ["flight", "trip", "hotel", "vacation"],
};

export interface QuickAddDraft {
  confidence: "low" | "medium" | "high";
  title: string;
  category: Category | null;
  contextId: string | null;
  subcategoryText: string | null;
  dueDate: string | null;
  dueTime: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseQuickAdd(input: string, contexts: Context[]): QuickAddDraft {
  const text = input.trim();
  const results = chrono.parse(text);
  const dateResult = results[0];

  let title = text;
  let dueDate: string | null = null;
  let dueTime: string | null = null;

  if (dateResult) {
    const date = dateResult.start.date();
    dueDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (dateResult.start.isCertain("hour")) {
      dueTime = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
    title = (text.slice(0, dateResult.index) + text.slice(dateResult.index + dateResult.text.length))
      .replace(/\s+/g, " ")
      .trim();
    if (!title) title = text;
  }

  const lowerText = text.toLowerCase();

  const matchedContext = contexts.find(
    (c) => c.status === "Active" && lowerText.includes(c.name.toLowerCase()),
  );

  let category: Category | null = null;
  let contextId: string | null = null;
  let subcategoryText: string | null = null;

  if (matchedContext) {
    category = CONTEXT_TYPE_TO_CATEGORY[matchedContext.type];
    contextId = matchedContext.id;
  } else {
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords!.some((kw) => lowerText.includes(kw))) {
        category = cat as Category;
        break;
      }
    }
  }

  const hasDateSignal = !!dateResult;
  const hasCategorySignal = !!category;

  const confidence: QuickAddDraft["confidence"] =
    hasDateSignal && hasCategorySignal ? "high" : hasDateSignal || hasCategorySignal ? "medium" : "low";

  if (category && !matchedContext && category !== "School" && category !== "Work" && category !== "Gym") {
    subcategoryText = null; // left for the user to fill in / pick a suggestion
  }

  return { confidence, title, category, contextId, subcategoryText, dueDate, dueTime };
}
