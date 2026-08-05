import { useMemo, useState } from "react";
import { CheckCircle2, Circle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickAddForm } from "@/components/dashboard/QuickAddForm";
import { useUpdateItem } from "@/hooks/useItems";
import { formatShortDue } from "@/lib/dashboardData";
import { daysUntil } from "@/lib/masterListViews";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

type TaskTab = "all" | "today" | "upcoming" | "completed";

const TABS: { id: TaskTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

function filterForTab(items: Item[], tab: TaskTab): Item[] {
  switch (tab) {
    case "today":
      // Includes overdue-and-not-done too — otherwise a missed due date has
      // nowhere to surface once "Today" has passed it by.
      return items.filter((i) => {
        const days = daysUntil(i.due_date);
        return days !== null && (days === 0 || (days < 0 && i.status !== "Completed"));
      });
    case "upcoming":
      return items
        .filter((i) => {
          const days = daysUntil(i.due_date);
          return days !== null && days > 0;
        })
        .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    case "completed":
      return items.filter((i) => i.status === "Completed").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    default:
      return [...items].sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"));
  }
}

export function MyTasksCard({ items }: { items: Item[] }) {
  const [tab, setTab] = useState<TaskTab>("all");
  const [showAdd, setShowAdd] = useState(false);
  const updateItem = useUpdateItem();

  const filtered = useMemo(() => filterForTab(items, tab), [items, tab]);

  const toggleComplete = (item: Item) => {
    updateItem.mutate({ ...item, status: item.status === "Completed" ? "Not Started" : "Completed" });
  };
  const togglePriority = (item: Item) => {
    updateItem.mutate({ ...item, priority: item.priority === "High" ? "Medium" : "High" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Tasks</CardTitle>
        <CardAction>
          <Button size="sm" onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? "Close" : "+ Add Task"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && <QuickAddForm onDone={() => setShowAdd(false)} />}

        <div className="flex gap-1">
          {TABS.map((t) => (
            <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}>
              {t.label}
            </Button>
          ))}
        </div>

        <div className="max-h-72 space-y-0.5 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here.</p>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted/40">
                <button type="button" onClick={() => toggleComplete(item)} className="shrink-0" aria-label="Toggle complete">
                  {item.status === "Completed" ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : (
                    <Circle className="size-4 text-muted-foreground" />
                  )}
                </button>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    item.status === "Completed" && "text-muted-foreground line-through",
                  )}
                >
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatShortDue(item.due_date)}</span>
                <button type="button" onClick={() => togglePriority(item)} className="shrink-0" aria-label="Toggle high priority">
                  <Star className={cn("size-4", item.priority === "High" ? "fill-primary text-primary" : "text-muted-foreground")} />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
