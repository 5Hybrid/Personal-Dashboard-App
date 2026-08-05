import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts, useCreateContext } from "@/hooks/useContexts";
import { useCreateItem, useItems, useUpdateItem } from "@/hooks/useItems";
import type { ItemStatus } from "@/types";

const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Completed",
  Completed: "Not Started",
};

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const createContext = useCreateContext();
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [owner, setOwner] = useState("");

  return (
    <form
      className="grid grid-cols-3 items-end gap-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        createContext.mutate({
          type: "Project",
          name,
          schedule: schedule || null,
          owner: owner || null,
        });
        setName("");
        setSchedule("");
        setOwner("");
        onCreated();
      }}
    >
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Schedule</Label>
        <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} />
      </div>
      <div>
        <Label>Manager/Client</Label>
        <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <Button type="submit" disabled={createContext.isPending} className="col-span-3 w-fit">
        Create Project
      </Button>
    </form>
  );
}

function ProjectItems({ projectId }: { projectId: string }) {
  const { data: items } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [title, setTitle] = useState("");

  const projectItems = (items ?? []).filter((i) => i.subcategory_id === projectId);

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createItem.mutate({ title, category: "Work", subcategory_id: projectId });
          setTitle("");
        }}
      >
        <Input
          placeholder="Task, meeting, or shift…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={createItem.isPending}>
          Add
        </Button>
      </form>

      {projectItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <ul className="space-y-1">
          {projectItems.map((item) => (
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

export default function Work() {
  const { data: contexts, isLoading, isError, error, refetch } = useContexts();
  const { data: items } = useItems();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projects = (contexts ?? []).filter((c) => c.type === "Project");

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Work</h1>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "New Project"}
        </Button>
      </div>

      {showForm && <NewProjectForm onCreated={() => setShowForm(false)} />}

      <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {projects.map((p) => {
            const projectItems = (items ?? []).filter((i) => i.subcategory_id === p.id);
            const completed = projectItems.filter((i) => i.status === "Completed").length;
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
                  {p.owner && <div>{p.owner}</div>}
                  <div>
                    {completed}/{projectItems.length} items completed
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
          <h2 className="mb-3 font-medium">
            {projects.find((p) => p.id === selectedId)?.name}
          </h2>
          <ProjectItems projectId={selectedId} />
        </div>
      )}
    </div>
  );
}
