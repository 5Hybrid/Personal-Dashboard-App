import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContexts } from "@/hooks/useContexts";
import { useCreateInboxItem } from "@/hooks/useInbox";
import { useCreateItem } from "@/hooks/useItems";
import { ALL_CATEGORIES, CATEGORY_TO_CONTEXT_TYPE } from "@/lib/categoryContext";
import { parseQuickAdd, type QuickAddDraft } from "@/lib/quickAdd";
import type { Category } from "@/types";

function DraftConfirm({ draft, onDone }: { draft: QuickAddDraft; onDone: () => void }) {
  const { data: contexts } = useContexts();
  const createItem = useCreateItem();

  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState<Category>(draft.category ?? "Personal");
  const [contextId, setContextId] = useState(draft.contextId ?? "");
  const [subcategoryText, setSubcategoryText] = useState(draft.subcategoryText ?? "");
  const [dueDate, setDueDate] = useState(draft.dueDate ?? "");
  const [dueTime, setDueTime] = useState(draft.dueTime ?? "");

  const contextType = CATEGORY_TO_CONTEXT_TYPE[category];
  const relevantContexts = contextType ? (contexts ?? []).filter((c) => c.type === contextType) : [];

  return (
    <form
      className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await createItem.mutateAsync({
          title,
          category,
          subcategory_id: contextType ? contextId || null : null,
          subcategory_text: contextType ? null : subcategoryText || null,
          due_date: dueDate || null,
          due_time: dueTime || null,
        });
        onDone();
      }}
    >
      <p className="text-xs text-muted-foreground">
        Parsed as {draft.confidence} confidence — review before adding:
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Title
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="w-56" />
        </label>
        <label className="text-xs">
          Category
          <select
            className="block h-9 rounded-md border px-2 text-sm"
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
              className="block h-9 rounded-md border px-2 text-sm"
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
            <Input
              value={subcategoryText}
              onChange={(e) => setSubcategoryText(e.target.value)}
              className="w-32"
            />
          </label>
        )}
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
          Due time
          <Input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="w-28"
          />
        </label>
        <Button type="submit" size="sm" disabled={createItem.isPending}>
          Confirm
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Local chrono-node parse + Context-name keyword matching, per spec §7.1.
// Nothing is ever filed silently: high/medium confidence still requires the
// Confirm click below; low confidence skips straight to the Inbox instead of
// guessing. No Card wrapper — callers (currently MyTasksCard's "+ Add Task"
// toggle) own the surrounding layout.
export function QuickAddForm({ onDone }: { onDone?: () => void }) {
  const { data: contexts } = useContexts();
  const createInboxItem = useCreateInboxItem();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<QuickAddDraft | null>(null);

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const parsed = parseQuickAdd(text, contexts ?? []);
          if (parsed.confidence === "low") {
            createInboxItem.mutate({ title: text });
            setText("");
            setDraft(null);
            onDone?.();
          } else {
            setDraft(parsed);
          }
        }}
      >
        <Input
          placeholder='Try "Finish finance assignment Friday at 11:59"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <Button type="submit" disabled={createInboxItem.isPending}>
          Add
        </Button>
      </form>

      {draft && (
        <DraftConfirm
          draft={draft}
          onDone={() => {
            setDraft(null);
            setText("");
            onDone?.();
          }}
        />
      )}
    </div>
  );
}
