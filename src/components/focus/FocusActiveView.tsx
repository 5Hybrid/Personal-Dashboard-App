import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FocusRing } from "@/components/focus/FocusRing";
import { elapsedSeconds, formatClock, remainingSeconds } from "@/lib/focusTiming";
import { useFocusStore } from "@/store/focusStore";
import type { FocusSession } from "@/types";

export function FocusActiveView({ session }: { session: FocusSession }) {
  const pause = useFocusStore((s) => s.pause);
  const resume = useFocusStore((s) => s.resume);
  const completePhase = useFocusStore((s) => s.completePhase);
  const abandon = useFocusStore((s) => s.abandon);
  useFocusStore((s) => s.tick); // re-render once a second while focus ticks

  const now = new Date();
  const elapsed = elapsedSeconds(session, now);
  const remaining = remainingSeconds(session, now);
  const isOpenFocus = session.planned_duration_seconds === null;
  const fraction =
    !isOpenFocus && session.planned_duration_seconds ? elapsed / session.planned_duration_seconds : 0;
  const isPaused = session.running_since === null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8">
      <div className="text-center">
        <p className="font-heading text-xl font-semibold">{session.intent}</p>
        {session.goal && <p className="text-sm text-muted-foreground">{session.goal}</p>}
      </div>

      {isOpenFocus ? (
        <div className="flex flex-col items-center gap-1 py-6">
          <span className="text-5xl font-semibold tabular-nums">{formatClock(elapsed)}</span>
          <span className="text-sm text-muted-foreground">Open Focus</span>
        </div>
      ) : (
        <FocusRing size={220} stroke={10} fraction={fraction}>
          <span className="text-4xl font-semibold tabular-nums">{formatClock(remaining ?? 0)}</span>
          <span className="text-sm text-muted-foreground">Focus</span>
        </FocusRing>
      )}

      <div className="flex items-center gap-3">
        <Button
          size="icon-lg"
          onClick={() => void (isPaused ? resume() : pause())}
          aria-label={isPaused ? "Resume" : "Pause"}
        >
          {isPaused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </Button>
        {isOpenFocus && (
          <Button variant="outline" onClick={() => void completePhase()}>
            Finish
          </Button>
        )}
      </div>

      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => void abandon()}
      >
        End Session
      </button>
    </div>
  );
}
