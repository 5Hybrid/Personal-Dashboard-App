import { CATEGORY_COLORS } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        CATEGORY_COLORS[category],
        className,
      )}
    >
      {category}
    </span>
  );
}
