import type { Context, Item } from "@/types";

export interface CategoryBreakdown {
  category: string;
  percent: number;
  weight: number;
  itemCount: number;
}

export interface GradeResult {
  currentGrade: number | null;
  letter: string | null;
  categoryBreakdown: CategoryBreakdown[];
}

const DEFAULT_CUTOFFS: Record<string, number> = { A: 90, B: 80, C: 70, D: 60 };

function gradeToLetter(grade: number, cutoffs: Record<string, number>): string {
  const sorted = Object.entries(cutoffs).sort((a, b) => b[1] - a[1]);
  for (const [letter, cutoff] of sorted) {
    if (grade >= cutoff) return letter;
  }
  return "F";
}

/**
 * Spec §7.3:
 * 1. Group graded Items (points_earned not null) by assignment_type.
 * 2. category_percent = sum(points_earned) / sum(points_possible) per group.
 * 3. current_grade = weighted average of category_percent by grade_scale weight,
 *    excluding categories with zero graded items from the denominator.
 * 4. Map current_grade to a letter using grade_cutoffs.
 */
export function calculateGrade(items: Item[], context: Context): GradeResult {
  const gradeScale = context.grade_scale ?? {};
  const gradeCutoffs = context.grade_cutoffs ?? DEFAULT_CUTOFFS;

  const byCategory = new Map<string, { earned: number; possible: number; count: number }>();
  for (const item of items) {
    if (item.points_earned == null || !item.assignment_type) continue;
    const entry = byCategory.get(item.assignment_type) ?? { earned: 0, possible: 0, count: 0 };
    entry.earned += item.points_earned;
    entry.possible += item.points_possible ?? 0;
    entry.count += 1;
    byCategory.set(item.assignment_type, entry);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  const categoryBreakdown: CategoryBreakdown[] = [];

  for (const [category, weight] of Object.entries(gradeScale)) {
    const entry = byCategory.get(category);
    if (!entry || entry.count === 0) continue;
    const percent = entry.possible > 0 ? (entry.earned / entry.possible) * 100 : 0;
    weightedSum += percent * weight;
    weightTotal += weight;
    categoryBreakdown.push({ category, percent, weight, itemCount: entry.count });
  }

  if (weightTotal === 0) {
    return { currentGrade: null, letter: null, categoryBreakdown };
  }

  const currentGrade = weightedSum / weightTotal;
  return { currentGrade, letter: gradeToLetter(currentGrade, gradeCutoffs), categoryBreakdown };
}
