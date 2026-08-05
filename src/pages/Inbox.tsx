import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts } from "@/hooks/useContexts";
import { useCreateInboxItem, useDeleteInboxItem, useInboxItems } from "@/hooks/useInbox";
import { useCreateItem } from "@/hooks/useItems";
import { ALL_CATEGORIES, CATEGORY_TO_CONTEXT_TYPE } from "@/lib/categoryContext";
import type { Category, InboxItem, Priority } from "@/types";

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
        <select
          className="block border rounded px-2 py-1 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as Category);
            setContextId("");
          }}
        >
          {ALL_CATEGORIES.map((cat) => (
            <option key={cat}>{cat}</option>
          ))}
        </select>
      </label>

      {contextType ? (
        <label className="text-xs">
          {contextType}
          <select
            className="block border rounded px-2 py-1 text-sm"
            value={contextId}
            onChange={(e) => setContextId(e.target.value)}
          >
            <option value="">— none —</option>
            {relevantContexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
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
        <select
          className="block border rounded px-2 py-1 text-sm"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
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
