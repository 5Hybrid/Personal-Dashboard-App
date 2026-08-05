import { create } from "zustand";
import { commands } from "@/lib/commands";

export type PomodoroPhase = "focus" | "shortBreak" | "longBreak";

export const PHASE_DURATIONS: Record<PomodoroPhase, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  focus: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const SESSIONS_BEFORE_LONG_BREAK = 4;

interface PomodoroState {
  phase: PomodoroPhase;
  secondsLeft: number;
  isRunning: boolean;
  completedFocusSessions: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

// Module-level (not store state) so the countdown keeps ticking regardless of
// which page is mounted — a React effect tied to FocusTimerCard would stop
// the instant the user navigates away from the Dashboard, defeating the
// point of a background focus timer.
let intervalId: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function notifyPhaseChange(phase: PomodoroPhase) {
  const body = phase === "focus" ? "Break's over — back to focus." : "Nice work — take a break.";
  commands.notifyNow(`Time for a ${PHASE_LABEL[phase]}`, body).catch(() => {});
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  phase: "focus",
  secondsLeft: PHASE_DURATIONS.focus,
  isRunning: false,
  completedFocusSessions: 0,

  start: () => {
    if (intervalId !== null) return; // already running
    set({ isRunning: true });
    intervalId = setInterval(() => {
      const { secondsLeft, phase, completedFocusSessions } = get();
      if (secondsLeft <= 1) {
        let nextPhase: PomodoroPhase;
        let nextCompleted = completedFocusSessions;
        if (phase === "focus") {
          nextCompleted += 1;
          nextPhase = nextCompleted % SESSIONS_BEFORE_LONG_BREAK === 0 ? "longBreak" : "shortBreak";
        } else {
          nextPhase = "focus";
        }
        set({
          phase: nextPhase,
          secondsLeft: PHASE_DURATIONS[nextPhase],
          completedFocusSessions: nextCompleted,
        });
        notifyPhaseChange(nextPhase);
      } else {
        set({ secondsLeft: secondsLeft - 1 });
      }
    }, 1000);
  },

  pause: () => {
    clearTimer();
    set({ isRunning: false });
  },

  reset: () => {
    clearTimer();
    set((state) => ({ isRunning: false, secondsLeft: PHASE_DURATIONS[state.phase] }));
  },
}));
