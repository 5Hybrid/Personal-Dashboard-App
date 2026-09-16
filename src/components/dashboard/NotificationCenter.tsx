import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpcomingNotifications } from "@/hooks/useUpcomingNotifications";
import { CATEGORY_DOT_CLASS } from "@/lib/categoryColors";
import { timeOfDayGreeting } from "@/lib/greeting";
import { relativeDueLabel, summarizeCandidates, type NotificationCandidate, type Urgency } from "@/lib/notificationEngine";
import { cn } from "@/lib/utils";
import type { Item } from "@/types";

const COLLAPSED_LIMIT = 4;

const URGENCY_DUE_CLASS: Record<Urgency, string> = {
  overdue: "text-destructive font-medium",
  today: "text-primary font-medium",
  tomorrow: "text-primary",
  soon: "text-muted-foreground",
  upcoming: "text-muted-foreground",
};

const PRIORITY_BADGE_CLASS: Record<Item["priority"], string> = {
  High: "border-primary text-primary",
  Medium: "border-muted-foreground/40 text-muted-foreground",
  Low: "border-muted-foreground/20 text-muted-foreground",
};

function NotificationRow({
  candidate,
  onView,
  onDismiss,
}: {
  candidate: NotificationCandidate;
  onView: () => void;
  onDismiss: () => void;
}) {
  const { item, days, urgency, kind } = candidate;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border/60 p-3 text-sm">
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", CATEGORY_DOT_CLASS[item.category])} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{kind}</p>
        <p className={cn("mt-0.5 text-xs", URGENCY_DUE_CLASS[urgency])}>{relativeDueLabel(item, days)}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
          PRIORITY_BADGE_CLASS[item.priority],
        )}
      >
        {item.priority}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="outline" onClick={onView}>
          View
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={onDismiss}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The proactive, launch-time layer on top of the existing Upcoming
 * Deadlines/Today's Schedule cards — surfaces once per Dashboard visit when
 * there's something actionable, then gets out of the way. "View" hands off
 * to Master List (the existing source of truth for every item) rather than
 * duplicating any item detail UI here.
 */
export function NotificationCenter({ items, itemsReady }: { items: Item[]; itemsReady: boolean }) {
  const navigate = useNavigate();
  const { candidates, dismissOne, dismissAll } = useUpcomingNotifications(items, itemsReady);
  const [expanded, setExpanded] = useState(false);

  if (candidates.length === 0) return null;

  const summary = summarizeCandidates(candidates);
  const visible = expanded ? candidates : candidates.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = candidates.length - visible.length;

  const viewItem = () => {
    dismissAll();
    navigate("/master-list");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && dismissAll()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            {timeOfDayGreeting()} — here's what needs your attention
          </DialogTitle>
          <DialogDescription>
            {summary.total} upcoming item{summary.total === 1 ? "" : "s"}
            {summary.overdue > 0 && <> · {summary.overdue} overdue</>}
            {summary.highPriority > 0 && <> · {summary.highPriority} high priority</>}
            {summary.events > 0 && <> · {summary.events} event{summary.events === 1 ? "" : "s"}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {visible.map((candidate) => (
            <NotificationRow
              key={candidate.item.id}
              candidate={candidate}
              onView={viewItem}
              onDismiss={() => dismissOne(candidate.item.id)}
            />
          ))}
        </div>

        {hiddenCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
            Show {hiddenCount} more
          </Button>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={dismissAll}>
            Dismiss all
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
