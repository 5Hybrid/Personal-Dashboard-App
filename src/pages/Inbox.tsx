import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts } from "@/hooks/useContexts";
import { useCreateInboxItem, useDeleteInboxItem, useInboxItems } from "@/hooks/useInbox";
import { useCreateItem } from "@/hooks/useItems";
import { ALL_CATEGORIES, CATEGORY_TO_CONTEXT_TYPE } from "@/lib/categoryContext";
import type { Category, InboxItem, Priority } from "@/types";

// Radix Select.Item can't take an empty-string value, so "no context" uses
// this sentinel and gets translated back to "" here.
const NO_CONTEXT = "__none__";

function CaptureForm() {
  const createInboxItem = useCreateInboxItem();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        createInboxItem.mutate({ title, notes: notes || null });
        setTitle("");
        setNotes("");
      }}
    >
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="Capture a title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full border rounded px-3 py-2 text-sm"
        placeholder="Optional freeform notes…"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <Button type="submit" disabled={createInboxItem.isPending}>
        Capture
      </Button>
    </form>
  );
}

function ProcessForm({ inboxItem, onDone }: { inboxItem: InboxItem; onDone: () => void }) {
  const { data: contexts } = useContexts();
  const createItem = useCreateItem();
  const deleteInboxItem = useDeleteInboxItem();

  const [category, setCategory] = useState<Category>("Personal");
  const [contextId, setContextId] = useState<string>("");
  const [subcategoryText, setSubcategoryText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");

  const contextType = CATEGORY_TO_CONTEXT_TYPE[category];
  const relevantContexts = contextType
    ? (contexts ?? []).filter((c) => c.type === contextType)
    : [];

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 rounded-md border bg-muted/30 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await createItem.mutateAsync({
          title: inboxItem.title,
          notes: inboxItem.notes,
          category,
          subcategory_id: contextType ? contextId || null : null,
          subcategory_text: contextType ? null : subcategoryText || null,
          due_date: dueDate || null,
          priority,
        });
        await deleteInboxItem.mutateAsync(inboxItem.id);
        onDone();
      }}
    >
      <label className="text-xs">
        Category
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as Category);
            setContextId("");
          }}
        >
          <SelectTrigger className="block w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {contextType ? (
        <label className="text-xs">
          {contextType}
          <Select value={contextId || NO_CONTEXT} onValueChange={(v) => setContextId(v === NO_CONTEXT ? "" : v)}>
            <SelectTrigger className="block w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CONTEXT}>— none —</SelectItem>
              {relevantContexts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : (
        <label className="text-xs">
          Subcategory
          <input
            className="block border rounded px-2 py-1 text-sm"
            value={subcategoryText}
            onChange={(e) => setSubcategoryText(e.target.value)}
          />
        </label>
      )}

      <label className="text-xs">
        Due date
        <input
          type="date"
          className="block border rounded px-2 py-1 text-sm"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
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

      <Button type="submit" size="sm" disabled={createItem.isPending || deleteInboxItem.isPending}>
        Confirm
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

export default function Inbox() {
  const { data: inboxItems, isLoading, isError, error, refetch } = useInboxItems();
  const deleteInboxItem = useDeleteInboxItem();
  const [processingId, setProcessingId] = useState<string | null>(null);

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quick capture now, decide what it is later.
        </p>
      </div>

      <CaptureForm />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Unprocessed ({inboxItems?.length ?? 0})</h2>
        <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {inboxItems && inboxItems.length > 0 ? (
          <ul className="space-y-2">
            {inboxItems.map((inboxItem) => (
              <li key={inboxItem.id} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{inboxItem.title}</p>
                    {inboxItem.notes && (
                      <p className="text-xs text-muted-foreground">{inboxItem.notes}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={processingId === inboxItem.id ? "outline" : "default"}
                    onClick={() =>
                      setProcessingId(processingId === inboxItem.id ? null : inboxItem.id)
                    }
                  >
                    {processingId === inboxItem.id ? "Close" : "Process"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteInboxItem.mutate(inboxItem.id)}
                  >
                    Discard
                  </Button>
                </div>
                {processingId === inboxItem.id && (
                  <ProcessForm inboxItem={inboxItem} onDone={() => setProcessingId(null)} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Inbox is empty.</p>
        )}
        </QueryBoundary>
      </section>
    </div>
  );
}
