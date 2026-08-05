import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ColorSwatchPicker } from "@/components/ColorSwatchPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts, useUpdateContext } from "@/hooks/useContexts";
import { useItems } from "@/hooks/useItems";
import { CLASS_COLOR_SWATCH_CLASS, isClassColorKey } from "@/lib/classColors";
import { cn } from "@/lib/utils";
import type { Context } from "@/types";
import { OverviewTab } from "./tabs/OverviewTab";
import { AssignmentsTab } from "./tabs/AssignmentsTab";
import { GradesTab } from "./tabs/GradesTab";
import { NotesTab } from "./tabs/NotesTab";

// Mirrors SchoolHome.tsx's NewClassForm fields/layout exactly, pre-filled
// from the existing Context and calling updateContext instead of
// createContext — same grade-scale editing UI so it feels like the same form.
function EditClassForm({ context, onDone }: { context: Context; onDone: () => void }) {
  const updateContext = useUpdateContext();
  const [name, setName] = useState(context.name);
  const [term, setTerm] = useState(context.term ?? "");
  const [schedule, setSchedule] = useState(context.schedule ?? "");
  const [owner, setOwner] = useState(context.owner ?? "");
  const [color, setColor] = useState<string | null>(context.color);
  const [gradeScale, setGradeScale] = useState<[string, number][]>(
    context.grade_scale ? Object.entries(context.grade_scale) : [],
  );

  return (
    <form
      className="space-y-3 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        updateContext.mutate({
          ...context,
          name,
          term: term || null,
          schedule: schedule || null,
          owner: owner || null,
          color,
          grade_scale: Object.fromEntries(gradeScale.filter(([k]) => k.trim())),
        });
        onDone();
      }}
    >
      <h3 className="font-medium">Edit Class</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="edit-class-name">Name</Label>
          <Input id="edit-class-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="edit-class-term">Term</Label>
          <Input
            id="edit-class-term"
            placeholder="Fall 2026"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit-class-schedule">Schedule</Label>
          <Input
            id="edit-class-schedule"
            placeholder="MWF 10:00–10:50"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="edit-class-owner">Professor</Label>
          <Input id="edit-class-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
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

      <div className="flex gap-2">
        <Button type="submit" disabled={updateContext.isPending}>
          Save Changes
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function ClassWorkspace() {
  const { contextId } = useParams();
  const contextsQuery = useContexts();
  const itemsQuery = useItems();
  const [editing, setEditing] = useState(false);

  const context = contextsQuery.data?.find((c) => c.id === contextId);
  const classItems = (itemsQuery.data ?? []).filter((i) => i.subcategory_id === contextId);

  return (
    <QueryBoundary
      isLoading={contextsQuery.isLoading || itemsQuery.isLoading}
      isError={contextsQuery.isError || itemsQuery.isError}
      error={contextsQuery.error ?? itemsQuery.error}
      onRetry={() => {
        contextsQuery.refetch();
        itemsQuery.refetch();
      }}
    >
      {!context ? (
        <div className="p-8 text-sm text-muted-foreground">Class not found.</div>
      ) : (
    <div className="space-y-6 p-8">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to="/school">
          <ChevronLeft className="size-4" />
          Back to Classes
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {isClassColorKey(context.color) && (
              <span className={cn("size-3 shrink-0 rounded-full", CLASS_COLOR_SWATCH_CLASS[context.color])} />
            )}
            {context.name}
          </h1>
          {context.term && <p className="text-sm text-muted-foreground">{context.term}</p>}
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit Class
          </Button>
        )}
      </div>

      {editing && (
        <Card>
          <CardContent className="pt-6">
            <EditClassForm context={context} onDone={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="grades">Grades</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab context={context} items={classItems} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab context={context} items={classItems} />
        </TabsContent>
        <TabsContent value="grades">
          <GradesTab context={context} items={classItems} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab contextId={context.id} items={classItems} />
        </TabsContent>
      </Tabs>
    </div>
      )}
    </QueryBoundary>
  );
}
