import { CheckCircle2, Circle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { formatFocusDuration, recentSessions } from "@/lib/focusStatistics";
import type { FocusOutcome, FocusSession } from "@/types";

function OutcomeIcon({ outcome }: { outcome: FocusOutcome | null }) {
  switch (outcome) {
    case "completed":
      return <CheckCircle2 className="size-4 shrink-0 text-primary" aria-label="Completed" />;
    case "partial":
      return (
        <span className="text-xs text-muted-foreground" aria-label="Partially completed">
          ~
        </span>
      );
    case "interrupted":
      return <X className="size-4 shrink-0 text-muted-foreground" aria-label="Interrupted" />;
    default:
      return <Circle className="size-4 shrink-0 text-muted-foreground" aria-label="Not completed" />;
  }
}

function formatStartedAt(startedAt: string): string {
  return new Date(startedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SessionRow({ session }: { session: FocusSession }) {
  return (
    <div className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted/40">
      <OutcomeIcon outcome={session.outcome} />
      <div className="min-w-0 flex-1">
        <p className="truncate">{session.intent}</p>
        <p className="text-xs text-muted-foreground">{formatStartedAt(session.started_at)}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatFocusDuration(session.actual_duration_seconds ?? 0)}
      </span>
    </div>
  );
}

export function FocusHistoryList() {
  const { data } = useFocusSessions();
  const sessions = recentSessions(data ?? [], 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No focus sessions yet.</p>
        ) : (
          sessions.map((session) => <SessionRow key={session.id} session={session} />)
        )}
      </CardContent>
    </Card>
  );
}
