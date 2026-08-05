import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_BORDER_CLASS } from "@/lib/categoryColors";
import { todayTimeline } from "@/lib/dashboardData";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

export function TodaysScheduleCard({ items }: { items: Item[] }) {
  const schedule = todayTimeline(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled for today.</p>
        ) : (
          schedule.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-md border-l-4 bg-muted/30 py-1.5 pl-3 pr-2",
                CATEGORY_BORDER_CLASS[item.category],
              )}
            >
              <span className="w-14 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                {item.due_time ?? "All day"}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    item.status === "Completed" && "text-muted-foreground line-through",
                  )}
                >
                  {item.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.subcategory_text ?? item.category}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
