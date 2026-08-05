import type { Category, ContextType } from "@/types";

export const ALL_CATEGORIES: Category[] = [
  "School",
  "Work",
  "Gym",
  "Personal",
  "Finance",
  "Projects",
  "Relationships",
  "Health",
  "Travel",
  "Custom",
];

export const CATEGORY_TO_CONTEXT_TYPE: Partial<Record<Category, ContextType>> = {
  School: "Class",
  Work: "Project",
  Gym: "Program",
};

export const CONTEXT_TYPE_TO_CATEGORY: Record<ContextType, Category> = {
  Class: "School",
  Project: "Work",
  Program: "Gym",
};
