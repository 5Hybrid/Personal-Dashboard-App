import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PHASE_DURATIONS, PHASE_LABEL, usePomodoroStore } from "@/store/pomodoroStore";

const SIZE = 168;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Standard Pomodoro Technique cadence (25 min focus / 5 min short break / 15
// min long break every 4th focus session) — see pomodoroStore.ts for the
// actual ticking logic, which lives outside React so it keeps running across
// page navigation rather than only while this card happens to be mounted.
export function FocusTimerCard() {
  const { phase, secondsLeft, isRunning, start, pause, reset } = usePomodoroStore();

  const total = PHASE_DURATIONS[phase];
  const fraction = 1 - secondsLeft / total;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Focus Timer</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-semibold tabular-nums">{formatClock(secondsLeft)}</span>
            <span className="text-sm text-muted-foreground">{PHASE_LABEL[phase]}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="icon" onClick={() => (isRunning ? pause() : start())} aria-label={isRunning ? "Pause" : "Start"}>
            {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button size="icon" variant="outline" onClick={reset} aria-label="Reset">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
