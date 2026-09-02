import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FocusStartDialog } from "@/components/focus/FocusStartDialog";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import { formatFocusDuration, sessionsToday, todayFocusedSeconds } from "@/lib/focusStatistics";
import { elapsedSeconds, formatClock, remainingSeconds } from "@/lib/focusTiming";
import { useFocusStore } from "@/store/focusStore";

// The Dashboard's compact entry point into the Focus system — idle (start
// prompt), active (live remaining/elapsed time), or today's running total
// once at least one session has finished. Full timer/break/reflection/
// history live on the dedicated /focus page; this widget stays a one-glance
// summary, matching the spec's "should remain compact and not dominate the
// dashboard."
export function FocusWidget() {
  const session = useFocusStore((s) => s.session);
  useFocusStore((s) => s.tick); // re-render once a second while a session ticks
  const [startOpen, setStartOpen] = useState(false);
  const sessionsQuery = useFocusSessions();
  const sessions = sessionsQuery.data ?? [];

  if (session) {
    const now = new Date();
    const isOpenFocus = session.planned_duration_seconds === null && session.phase === "focus";
    const display = isOpenFocus
      ? `${formatClock(elapsedSeconds(session, now))} elapsed`
      : `${formatClock(remainingSeconds(session, now) ?? 0)} remaining`;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {session.phase === "break" ? "On break" : "Focusing"}
          </p>
          <p className="truncate font-heading text-lg font-medium">{session.intent}</p>
          <p className="text-2xl font-semibold tabular-nums">{display}</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/focus">Open Focus</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const today = sessionsToday(sessions);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{today.length > 0 ? "Today's Focus" : "Focus"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {today.length > 0 ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">{formatFocusDuration(todayFocusedSeconds(sessions))}</p>
            <p className="text-sm text-muted-foreground">
              {today.length} session{today.length === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ready to focus?</p>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setStartOpen(true)}>
            Start Focus
          </Button>
          {today.length > 0 && (
            <Button asChild size="sm" variant="outline">
              <Link to="/focus">View Progress</Link>
            </Button>
          )}
        </div>
      </CardContent>
      <FocusStartDialog open={startOpen} onOpenChange={setStartOpen} />
    </Card>
  );
}
