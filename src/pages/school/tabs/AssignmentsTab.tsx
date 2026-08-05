import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateItem, useSoftDeleteItem, useUpdateItem } from "@/hooks/useItems";
import { assignmentRowClass, COMPLETED_TEXT_CLASS } from "@/lib/classColors";
import { NEXT_STATUS } from "@/lib/itemStatus";
import { daysUntil } from "@/lib/masterListViews";
import { cn } from "@/lib/utils";
import type { Context, Item } from "@/types";

function AddAssignmentForm({ context }: { context: Context }) {
  const createItem = useCreateItem();
  const [title, setTitle] = useState("");
  const [assignmentType, setAssignmentType] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pointsEarned, setPointsEarned] = useState("");
  const [pointsPossible, setPointsPossible] = useState("");

  const gradeScaleKeys = Object.keys(context.grade_scale ?? {});

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createItem.mutate({
          title,
          category: "School",
          subcategory_id: context.id,
          due_date: dueDate || null,
          assignment_type: assignmentType || null,
          points_earned: pointsEarned ? Number(pointsEarned) : null,
          points_possible: pointsPossible ? Number(pointsPossible) : null,
        });
        setTitle("");
        setDueDate("");
        setPointsEarned("");
        setPointsPossible("");
      }}
    >
      <label className="text-xs">
        Assignment
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-48" />
      </label>
      <label className="text-xs">
        Type
        <select
          className="block h-9 rounded-md border px-2 text-sm"
          value={assignmentType}
          onChange={(e) => setAssignmentType(e.target.value)}
        >
          <option value="">—</option>
          {gradeScaleKeys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Due date
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-40"
        />
      </label>
      <label className="text-xs">
        Points earned
        <Input
          type="number"
          value={pointsEarned}
          onChange={(e) => setPointsEarned(e.target.value)}
          className="w-24"
        />
      </label>
      <label className="text-xs">
        Points possible
        <Input
          type="number"
          value={pointsPossible}
          onChange={(e) => setPointsPossible(e.target.value)}
          className="w-24"
        />
      </label>
      <Button type="submit" size="sm" disabled={createItem.isPending}>
        Add Assignment
      </Button>
    </form>
  );
}

// Same fields/layout as AddAssignmentForm, pre-filled from the Item being
// edited and calling updateItem instead of createItem.
function EditAssignmentForm({ context, item, onDone }: { context: Context; item: Item; onDone: () => void }) {
  const updateItem = useUpdateItem();
  const [title, setTitle] = useState(item.title);
  const [assignmentType, setAssignmentType] = useState(item.assignment_type ?? "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [pointsEarned, setPointsEarned] = useState(item.points_earned?.toString() ?? "");
  const [pointsPossible, setPointsPossible] = useState(item.points_possible?.toString() ?? "");

  const gradeScaleKeys = Object.keys(context.grade_scale ?? {});

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        updateItem.mutate({
          ...item,
          title,
          due_date: dueDate || null,
          assignment_type: assignmentType || null,
          points_earned: pointsEarned ? Number(pointsEarned) : null,
          points_possible: pointsPossible ? Number(pointsPossible) : null,
        });
        onDone();
      }}
    >
      <label className="text-xs">
        Assignment
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-48" />
      </label>
      <label className="text-xs">
        Type
        <select
          className="block h-9 rounded-md border px-2 text-sm"
          value={assignmentType}
          onChange={(e) => setAssignmentType(e.target.value)}
        >
          <option value="">—</option>
          {gradeScaleKeys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Due date
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-40"
        />
      </label>
      <label className="text-xs">
        Points earned
        <Input
          type="number"
          value={pointsEarned}
          onChange={(e) => setPointsEarned(e.target.value)}
          className="w-24"
        />
      </label>
      <label className="text-xs">
        Points possible
        <Input
          type="number"
          value={pointsPossible}
          onChange={(e) => setPointsPossible(e.target.value)}
          className="w-24"
        />
      </label>
      <Button type="submit" size="sm" disabled={updateItem.isPending}>
        Save
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

export function AssignmentsTab({ context, items }: { context: Context; items: Item[] }) {
  const updateItem = useUpdateItem();
  const softDeleteItem = useSoftDeleteItem();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {editingId ? (
        <EditAssignmentForm
          context={context}
          item={items.find((i) => i.id === editingId)!}
          onDone={() => setEditingId(null)}
        />
      ) : (
        <AddAssignmentForm context={context} />
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assignments yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b px-2 py-1">Status</th>
              <th className="border-b px-2 py-1">Due Date</th>
              <th className="border-b px-2 py-1">Due Time</th>
              <th className="border-b px-2 py-1">Type</th>
              <th className="border-b px-2 py-1">Assignment</th>
              <th className="border-b px-2 py-1">Days Until Due</th>
              <th className="border-b px-2 py-1">Points Earned</th>
              <th className="border-b px-2 py-1">Points Possible</th>
              <th className="border-b px-2 py-1">Grade</th>
              <th className="border-b px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const grade =
                item.points_earned != null && item.points_possible
                  ? `${((item.points_earned / item.points_possible) * 100).toFixed(1)}%`
                  : "—";
              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b hover:brightness-95",
                    assignmentRowClass(context.color, item.status),
                  )}
                >
                  <td className="px-2 py-1">
                    <button
                      className="text-xs underline"
                      onClick={() =>
                        updateItem.mutate({ ...item, status: NEXT_STATUS[item.status] })
                      }
                    >
                      {item.status}
                    </button>
                  </td>
                  <td className="px-2 py-1">{item.due_date ?? "—"}</td>
                  <td className="px-2 py-1">{item.due_time ?? "—"}</td>
                  <td className="px-2 py-1">{item.assignment_type ?? "—"}</td>
                  <td className={cn("px-2 py-1", item.status === "Completed" && COMPLETED_TEXT_CLASS)}>
                    {item.title}
                  </td>
                  <td className="px-2 py-1">{daysUntil(item.due_date) ?? "—"}</td>
                  <td className="px-2 py-1">{item.points_earned ?? "—"}</td>
                  <td className="px-2 py-1">{item.points_possible ?? "—"}</td>
                  <td className="px-2 py-1">{grade}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(item.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        softDeleteItem.mutate(item.id);
                        if (editingId === item.id) setEditingId(null);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
