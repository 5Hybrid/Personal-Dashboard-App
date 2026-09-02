import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FocusActiveView } from "@/components/focus/FocusActiveView";
import { FocusBreakView } from "@/components/focus/FocusBreakView";
import { FocusHistoryList } from "@/components/focus/FocusHistoryList";
import { FocusProgressStats } from "@/components/focus/FocusProgressStats";
import { FocusStartDialog } from "@/components/focus/FocusStartDialog";
import { useFocusStore } from "@/store/focusStore";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export default function Focus() {
  const session = useFocusStore((s) => s.session);
  const pause = useFocusStore((s) => s.pause);
  const resume = useFocusStore((s) => s.resume);
  const navigate = useNavigate();
  const [startOpen, setStartOpen] = useState(false);

  // Space pauses/resumes an active focus countdown, Esc returns to the
  // Dashboard — scoped to this page only, and never while a text field
  // (intent/goal/note) has focus, so it can't fight normal typing.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "Escape") {
        navigate("/");
        return;
      }
      if (e.key === " " && session?.phase === "focus") {
        e.preventDefault();
        void (session.running_since ? pause() : resume());
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, pause, resume, navigate]);

  const announcement = !session
    ? "No active focus session"
    : session.phase === "focus"
      ? `Focusing: ${session.intent}`
      : "Break time";

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Focus</h1>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {session ? (
        session.phase === "focus" ? (
          <FocusActiveView session={session} />
        ) : (
          <FocusBreakView session={session} />
        )
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground">Ready to focus?</p>
            <Button onClick={() => setStartOpen(true)}>Start Focus</Button>
          </div>
          <FocusProgressStats />
          <FocusHistoryList />
        </div>
      )}

      <FocusStartDialog open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}
