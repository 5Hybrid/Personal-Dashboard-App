import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateNote, useDeleteNote, useNotesForContext } from "@/hooks/useNotes";
import type { Item } from "@/types";

// Radix Select.Item can't take an empty-string value, so "not linked" uses
// this sentinel and gets translated back to "" here.
const NOT_LINKED = "__none__";

export function NotesTab({ contextId, items }: { contextId: string; items: Item[] }) {
  const { data: notes, isLoading } = useNotesForContext(contextId);
  const createNote = useCreateNote(contextId);
  const deleteNote = useDeleteNote(contextId);

  const [body, setBody] = useState("");
  const [linkedItemId, setLinkedItemId] = useState("");

  const itemTitleById = new Map(items.map((i) => [i.id, i.title]));

  return (
    <div className="max-w-2xl space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          createNote.mutate({ context_id: contextId, item_id: linkedItemId || null, body });
          setBody("");
          setLinkedItemId("");
        }}
      >
        <Textarea
          placeholder="Write a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Select
            value={linkedItemId || NOT_LINKED}
            onValueChange={(v) => setLinkedItemId(v === NOT_LINKED ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_LINKED}>Not linked to an assignment</SelectItem>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={createNote.isPending}>
            Add Note
          </Button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : notes && notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3">
              <p className="text-sm whitespace-pre-wrap">{note.body}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {note.item_id ? `Linked to: ${itemTitleById.get(note.item_id) ?? "?"}` : ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => deleteNote.mutate(note.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
