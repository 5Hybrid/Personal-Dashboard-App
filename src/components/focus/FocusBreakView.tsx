import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FocusReflection } from "@/components/focus/FocusReflection";
import { FocusRing } from "@/components/focus/FocusRing";
import { elapsedSeconds, formatClock, remainingSeconds } from "@/lib/focusTiming";
import { useFocusStore } from "@/store/focusStore";
import type { FocusSession } from "@/types";

export function FocusBreakView({ session }: { session: FocusSession }) {
  const endBreak = useFocusStore((s) => s.endBreak);
  useFocusStore((s) => s.tick); // re-render once a second while the break ticks

  const [reflected, setReflected] = useState(false);
  useEffect(() => setReflected(false), [session.id]);

  const now = new Date();
  const remaining = remainingSeconds(session, now) ?? 0;
  const elapsed = elapsedSeconds(session, now);
  const fraction = session.break_duration_seconds > 0 ? elapsed / session.break_duration_seconds : 1;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
      {!reflected && <FocusReflection session={session} onDone={() => setReflected(true)} />}

      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <p className="text-sm text-muted-foreground">Break</p>
          <FocusRing size={200} stroke={10} fraction={fraction}>
            <span className="text-3xl font-semibold tabular-nums">{formatClock(remaining)}</span>
          </FocusRing>
          <Button variant="outline" onClick={() => void endBreak()}>
            Skip Break
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
