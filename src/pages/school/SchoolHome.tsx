import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts, useCreateContext } from "@/hooks/useContexts";
import { useItems } from "@/hooks/useItems";
import { CLASS_COLOR_SWATCH_CLASS, isClassColorKey } from "@/lib/classColors";
import { cn } from "@/lib/utils";

const DEFAULT_GRADE_SCALE: [string, number][] = [
  ["Homework", 20],
  ["Quiz", 20],
  ["Exam", 40],
  ["Project", 20],
];

function NewClassForm({ onCreated }: { onCreated: () => void }) {
  const createContext = useCreateContext();
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [schedule, setSchedule] = useState("");
  const [owner, setOwner] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [gradeScale, setGradeScale] = useState<[string, number][]>(DEFAULT_GRADE_SCALE);

  return (
    <form
      className="space-y-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createContext.mutate({
          type: "Class",
          name,
          term: term || null,
          schedule: schedule || null,
          owner: owner || null,
          color,
          grade_scale: Object.fromEntries(gradeScale.filter(([k]) => k.trim())),
        });
        setName("");
        setTerm("");
        setSchedule("");
        setOwner("");
        setColor(null);
        setGradeScale(DEFAULT_GRADE_SCALE);
        onCreated();
      }}
    >
      <h3 className="font-medium">New Class</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="class-name">Name</Label>
          <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="class-term">Term</Label>
          <Input
            id="class-term"
            placeholder="Fall 2026"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="class-schedule">Schedule</Label>
          <Input
            id="class-schedule"
            placeholder="MWF 10:00–10:50"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="class-owner">Professor</Label>
          <Input id="class-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Color</Label>
        <div className="mt-1">
          <ColorSwatchPicker value={color} onChange={setColor} />
        </div>
      </div>

      <div>
        <Label>Grade scale (assignment type → weight %)</Label>
        <div className="mt-1 space-y-1">
          {gradeScale.map(([key, weight], i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-40"
                value={key}
                onChange={(e) => {
                  const next = [...gradeScale];
                  next[i] = [e.target.value, weight];
                  setGradeScale(next);
                }}
              />
              <Input
                type="number"
                className="w-24"
                value={weight}
                onChange={(e) => {
                  const next = [...gradeScale];
                  next[i] = [key, Number(e.target.value)];
                  setGradeScale(next);
                }}
              />
              <span className="text-xs text-muted-foreground">%</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setGradeScale(gradeScale.filter((_, idx) => idx !== i))}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setGradeScale([...gradeScale, ["", 0]])}
          >
            + Add category
          </Button>
        </div>
      </div>

      <Button type="submit" disabled={createContext.isPending}>
        Create Class
      </Button>
    </form>
  );
}

export default function SchoolHome() {
  const { data: contexts, isLoading, isError, error, refetch } = useContexts();
  const { data: items } = useItems();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  const classes = (contexts ?? []).filter((c) => c.type === "Class");

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">School</h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "New Class"}
        </Button>
      </div>

      {showForm && <NewClassForm onCreated={() => setShowForm(false)} />}

      <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      {classes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No classes yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {classes.map((c) => {
            const classItems = (items ?? []).filter((i) => i.subcategory_id === c.id);
            const completed = classItems.filter((i) => i.status === "Completed").length;
            return (
              <Card
                key={c.id}
                className="cursor-pointer hover:shadow-md"
                onClick={() => navigate(`/school/${c.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {isClassColorKey(c.color) && (
                      <span className={cn("size-2.5 shrink-0 rounded-full", CLASS_COLOR_SWATCH_CLASS[c.color])} />
                    )}
                    {c.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {c.term && <div>{c.term}</div>}
                  {c.owner && <div>{c.owner}</div>}
                  <div>
                    {completed}/{classItems.length} assignments completed
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </QueryBoundary>
    </div>
  );
}
