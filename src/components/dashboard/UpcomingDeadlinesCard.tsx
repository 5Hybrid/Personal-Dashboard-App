import { Link } from "react-router-dom";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORY_DOT_CLASS } from "@/lib/categoryColors";
import { formatShortDue, upcomingDeadlines } from "@/lib/dashboardData";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

const PRIORITY_BADGE_CLASS: Record<Item["priority"], string> = {
  High: "border-primary text-primary",
  Medium: "border-muted-foreground/40 text-muted-foreground",
  Low: "border-muted-foreground/20 text-muted-foreground",
};

export function UpcomingDeadlinesCard({ items }: { items: Item[] }) {
  const upcoming = upcomingDeadlines(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
        <CardAction>
          <Link to="/master-list" className="text-xs text-muted-foreground underline">
            View All
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due in the next week.</p>
        ) : (
          upcoming.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <span className={cn("size-2 shrink-0 rounded-full", CATEGORY_DOT_CLASS[item.category])} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {formatShortDue(item.due_date)} · {item.due_date}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                  PRIORITY_BADGE_CLASS[item.priority],
                )}
              >
                {item.priority}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
