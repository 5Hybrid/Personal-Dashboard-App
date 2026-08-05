import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts, useCreateContext } from "@/hooks/useContexts";
import { useCreateItem, useItems, useUpdateItem } from "@/hooks/useItems";
import {
  useCreatePersonalRecord,
  useDeletePersonalRecord,
  usePersonalRecords,
} from "@/hooks/usePersonalRecords";
import type { ItemStatus } from "@/types";

const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Completed",
  Completed: "Not Started",
};

function NewProgramForm({ onCreated }: { onCreated: () => void }) {
  const createContext = useCreateContext();
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");

  return (
    <form
      className="grid grid-cols-2 items-end gap-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createContext.mutate({ type: "Program", name, schedule: schedule || null });
        setName("");
        setSchedule("");
        onCreated();
      }}
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Schedule</Label>
        <Input
          placeholder="Push/Pull/Legs, 5x/week…"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={createContext.isPending} className="col-span-2 w-fit">
        Create Program
      </Button>
    </form>
  );
}

function ProgramSessions({ programId }: { programId: string }) {
  const { data: items } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [title, setTitle] = useState("");

  const sessions = (items ?? []).filter((i) => i.subcategory_id === programId);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createItem.mutate({ title, category: "Gym", subcategory_id: programId });
          setTitle("");
        }}
      >
        <Input
          placeholder="Workout or session…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={createItem.isPending}>
          Add
        </Button>
      </form>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions yet.</p>
      ) : (
        <ul className="space-y-1">
          {sessions.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <button
                className="underline"
                onClick={() => updateItem.mutate({ ...item, status: NEXT_STATUS[item.status] })}
              >
                {item.status}
              </button>
              <span className="flex-1">{item.title}</span>
              {item.due_date && (
                <span className="text-xs text-muted-foreground">{item.due_date}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonalRecords() {
  const { data: records } = usePersonalRecords();
  const createRecord = useCreatePersonalRecord();
  const deleteRecord = useDeletePersonalRecord();
  const [exerciseName, setExerciseName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("lb");

  return (
    <div className="space-y-3">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!exerciseName.trim() || !value) return;
          createRecord.mutate({ exercise_name: exerciseName, value: Number(value), unit });
          setExerciseName("");
          setValue("");
        }}
      >
        <div>
          <Label>Exercise</Label>
          <Input
            value={exerciseName}
            onChange={(e) => setExerciseName(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label>Value</Label>
          <Input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
          />
        </div>
        <div>
          <Label>Unit</Label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-16" />
        </div>
        <Button type="submit" size="sm" disabled={createRecord.isPending}>
          Save PR
        </Button>
      </form>

      {records && records.length > 0 ? (
        <ul className="space-y-1">
          {records.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-medium">{r.exercise_name}</span>
              <span>
                {r.value} {r.unit}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => deleteRecord.mutate(r.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No personal records yet.</p>
      )}
    </div>
  );
}

export default function Gym() {
  const { data: contexts, isLoading, isError, error, refetch } = useContexts();
  const { data: items } = useItems();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const programs = (contexts ?? []).filter((c) => c.type === "Program");

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gym</h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "New Program"}
        </Button>
      </div>

      {showForm && <NewProgramForm onCreated={() => setShowForm(false)} />}

      <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      {programs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No programs yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {programs.map((p) => {
            const sessions = (items ?? []).filter((i) => i.subcategory_id === p.id);
            const completed = sessions.filter((i) => i.status === "Completed").length;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer hover:shadow-md ${selectedId === p.id ? "ring-2 ring-ring" : ""}`}
                onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
              >
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {p.schedule && <div>{p.schedule}</div>}
                  <div>
                    {completed}/{sessions.length} sessions completed
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </QueryBoundary>

      {selectedId && (
        <div className="rounded-md border p-4">
          <h2 className="mb-3 font-medium">{programs.find((p) => p.id === selectedId)?.name}</h2>
          <ProgramSessions programId={selectedId} />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-medium">Personal Records</h2>
        <PersonalRecords />
      </div>
    </div>
  );
}
