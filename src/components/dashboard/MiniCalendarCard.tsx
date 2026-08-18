import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  addMonths,
  formatMonthYear,
  getMonthGrid,
  isSameDay,
  parseDateOnly,
  toDateKey,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/calendarGrid";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

// A compact month-glance, not a replacement for the full Calendar page's
// grid — just enough to see at a glance which days this month have
// something due, with a link through to the real thing.
export function MiniCalendarCard({ items }: { items: Item[] }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const weeks = useMemo(() => getMonthGrid(anchor), [anchor]);
  const today = new Date();

  const daysWithItems = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.due_date) set.add(toDateKey(parseDateOnly(item.due_date)));
    }
    return set;
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link to="/calendar">Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mb-2 flex items-center justify-between">
          <Button size="icon-sm" variant="outline" onClick={() => setAnchor((a) => addMonths(a, -1))} aria-label="Previous month">
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="text-sm font-medium">{formatMonthYear(anchor)}</span>
          <Button size="icon-sm" variant="outline" onClick={() => setAnchor((a) => addMonths(a, 1))} aria-label="Next month">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {WEEKDAY_SHORT_LABELS.map((label) => (
            <div key={label}>{label[0]}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === anchor.getMonth();
              const isToday = isSameDay(day, today);
              const hasItems = daysWithItems.has(key);
              return (
                <div key={key} className="flex flex-col items-center gap-0.5 py-1">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary font-medium text-primary-foreground",
                      !inMonth && !isToday && "text-muted-foreground/50",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className={cn("size-1 rounded-full", hasItems ? "bg-primary" : "bg-transparent")} />
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
