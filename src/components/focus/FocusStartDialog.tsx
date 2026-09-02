import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItems } from "@/hooks/useItems";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { useFocusStore } from "@/store/focusStore";
import type { Category } from "@/types";

const DURATION_PRESETS: { key: string; label: string; sublabel: string; seconds: number | null }[] = [
  { key: "15", label: "15 min", sublabel: "Quick Focus", seconds: 15 * 60 },
  { key: "25", label: "25 min", sublabel: "Pomodoro", seconds: 25 * 60 },
  { key: "50", label: "50 min", sublabel: "Extended Focus", seconds: 50 * 60 },
  { key: "90", label: "90 min", sublabel: "Deep Work", seconds: 90 * 60 },
  { key: "open", label: "Open Focus", sublabel: "No predetermined end", seconds: null },
];
const DEFAULT_DURATION_KEY = "25";
const BREAK_DURATION_SECONDS = 5 * 60;
const NO_TASK = "__none__";
const NO_CATEGORY = "__none__";

const CATEGORIES: Category[] = [
  "School",
  "Work",
  "Gym",
  "Personal",
  "Finance",
  "Projects",
  "Relationships",
  "Health",
  "Travel",
  "Custom",
];

const LAST_SESSION_PREF_KEY = "focus_last_session";

interface LastSession {
  intent: string;
  goal: string;
  itemId: string | null;
  category: Category | null;
  durationSeconds: number | null;
}

function parseLastSession(raw: string | undefined): LastSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastSession;
  } catch {
    return null;
  }
}

interface FocusStartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FocusStartDialog({ open, onOpenChange }: FocusStartDialogProps) {
  const itemsQuery = useItems();
  const prefsQuery = usePreferences();
  const setPreference = useSetPreference();
  const startSession = useFocusStore((s) => s.startSession);

  const [intent, setIntent] = useState("");
  const [goal, setGoal] = useState("");
  const [itemId, setItemId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [durationKey, setDurationKey] = useState(DEFAULT_DURATION_KEY);
  const [submitting, setSubmitting] = useState(false);

  // Snapshot the remembered last session once, at the moment the dialog
  // opens, so restarting a similar session is a single click (spec: "the
  // application should remember previous intention/task/category/duration").
  useEffect(() => {
    if (!open) return;
    const last = parseLastSession(prefsQuery.data?.[LAST_SESSION_PREF_KEY]);
    setIntent(last?.intent ?? "");
    setGoal(last?.goal ?? "");
    setItemId(last?.itemId ?? null);
    setCategory(last?.category ?? null);
    if (!last) {
      setDurationKey(DEFAULT_DURATION_KEY);
    } else if (last.durationSeconds === null) {
      setDurationKey("open");
    } else {
      const preset = DURATION_PRESETS.find((p) => p.seconds === last.durationSeconds);
      setDurationKey(preset?.key ?? DEFAULT_DURATION_KEY);
    }
    setSubmitting(false);
  }, [open]);

  const activeItems = (itemsQuery.data ?? []).filter((i) => i.status !== "Completed");
  const selectedPreset = DURATION_PRESETS.find((p) => p.key === durationKey) ?? DURATION_PRESETS[1];

  const handleItemSelect = (value: string) => {
    if (value === NO_TASK) {
      setItemId(null);
      return;
    }
    setItemId(value);
    const item = activeItems.find((i) => i.id === value);
    if (item) {
      setIntent((current) => current || item.title);
      setCategory(item.category);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedIntent = intent.trim();
    if (!trimmedIntent || submitting) return;
    setSubmitting(true);
    try {
      await startSession({
        intent: trimmedIntent,
        goal: goal.trim() || null,
        item_id: itemId,
        category,
        planned_duration_seconds: selectedPreset.seconds,
        break_duration_seconds: BREAK_DURATION_SECONDS,
      });
      const toSave: LastSession = {
        intent: trimmedIntent,
        goal: goal.trim(),
        itemId,
        category,
        durationSeconds: selectedPreset.seconds,
      };
      setPreference.mutate({ key: LAST_SESSION_PREF_KEY, value: JSON.stringify(toSave) });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>What are you working on?</DialogTitle>
          </DialogHeader>

          <Input
            autoFocus
            placeholder="e.g. CFA — Quantitative Methods"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
          />

          {activeItems.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="focus-task">Task (optional)</Label>
              <Select value={itemId ?? NO_TASK} onValueChange={handleItemSelect}>
                <SelectTrigger id="focus-task" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TASK}>None</SelectItem>
                  {activeItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="focus-category">Category (optional)</Label>
              <Select
                value={category ?? NO_CATEGORY}
                onValueChange={(v) => setCategory(v === NO_CATEGORY ? null : (v as Category))}
              >
                <SelectTrigger id="focus-category" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>None</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="focus-goal">Goal (optional)</Label>
              <Input
                id="focus-goal"
                placeholder="Complete 20 questions"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="sm"
                  variant={durationKey === preset.key ? "default" : "outline"}
                  onClick={() => setDurationKey(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!intent.trim() || submitting}>
              Start
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
