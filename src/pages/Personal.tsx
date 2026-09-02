import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useCreateItem, useItems, useSoftDeleteItem, useUpdateItem } from "@/hooks/useItems";
import type { ItemStatus, Priority } from "@/types";

const SUGGESTED_SUBCATEGORIES = [
  "Bills",
  "Appointments",
  "Birthdays",
  "Errands",
  "Reading",
  "Goals",
  "Travel",
];

const NEXT_STATUS: Record<ItemStatus, ItemStatus> = {
  "Not Started": "In Progress",
  "In Progress": "Completed",
  Completed: "Not Started",
};

function AddPersonalItemForm() {
  const createItem = useCreateItem();
  const [title, setTitle] = useState("");
  const [subcategoryText, setSubcategoryText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createItem.mutate({
          title,
          category: "Personal",
          subcategory_text: subcategoryText || null,
          due_date: dueDate || null,
          priority,
        });
        setTitle("");
        setDueDate("");
      }}
    >
      <label className="text-xs">
        Title
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-56" />
      </label>
      <label className="text-xs">
        Subcategory
        <Input
          list="personal-subcategories"
          value={subcategoryText}
          onChange={(e) => setSubcategoryText(e.target.value)}
          className="w-40"
        />
        <datalist id="personal-subcategories">
          {SUGGESTED_SUBCATEGORIES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
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
        Priority
        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
          <SelectTrigger className="block w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </label>
      <Button type="submit" disabled={createItem.isPending}>
        Add
      </Button>
    </form>
  );
}

export default function Personal() {
  const { data: items, isLoading, isError, error, refetch } = useItems();
  const updateItem = useUpdateItem();
  const softDeleteItem = useSoftDeleteItem();

  const groups = useMemo(() => {
    const personalItems = (items ?? []).filter((i) => i.category === "Personal");
    const map = new Map<string, typeof personalItems>();
    for (const item of personalItems) {
      const key = item.subcategory_text || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Personal</h1>

      <AddPersonalItemForm />

      <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([subcategory, groupItems]) => (
            <Fragment key={subcategory}>
              <h2 className="font-medium">
                {subcategory} ({groupItems.length})
              </h2>
              <ul className="space-y-1">
                {groupItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    <button
                      className="underline"
                      onClick={() =>
                        updateItem.mutate({ ...item, status: NEXT_STATUS[item.status] })
                      }
                    >
                      {item.status}
                    </button>
                    <span className="flex-1">{item.title}</span>
                    {item.due_date && (
                      <span className="text-xs text-muted-foreground">{item.due_date}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{item.priority}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => softDeleteItem.mutate(item.id)}
                    >
                      Delete
                    </Button>
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </div>
      )}
      </QueryBoundary>
    </div>
  );
}
