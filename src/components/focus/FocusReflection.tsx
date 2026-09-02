import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatFocusDuration } from "@/lib/focusStatistics";
import { useFocusStore } from "@/store/focusStore";
import type { FocusOutcome, FocusSession } from "@/types";

interface FocusReflectionProps {
  session: FocusSession;
  onDone: () => void;
}

// Shown the moment a focus phase ends, overlapping with the break that's
// already started — closes the intent → outcome loop in a few seconds
// without blocking anything: dismissing without answering just leaves the
// backend's default outcome ('completed') in place.
export function FocusReflection({ session, onDone }: FocusReflectionProps) {
  const submitReflection = useFocusStore((s) => s.submitReflection);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const choose = async (outcome: FocusOutcome) => {
    setSubmitting(true);
    try {
      await submitReflection(outcome, note.trim() || null);
    } finally {
      setSubmitting(false);
      onDone();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-base">Focus complete</CardTitle>
        <CardDescription>
          {formatFocusDuration(session.actual_duration_seconds ?? 0)} on &ldquo;{session.intent}&rdquo;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {session.goal ? `Did you accomplish "${session.goal}"?` : "Did you accomplish your goal?"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => void choose("completed")}>
            Yes
          </Button>
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => void choose("partial")}>
            Partially
          </Button>
          <Button size="sm" variant="outline" disabled={submitting} onClick={() => void choose("not_completed")}>
            Not yet
          </Button>
        </div>
        <Input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={onDone}
        >
          Skip
        </button>
      </CardContent>
    </Card>
  );
}
