import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useCreateQuickNote, useDeleteQuickNote, useQuickNotes } from "@/hooks/useQuickNotes";

export function QuickNotesCard() {
  const notesQuery = useQuickNotes();
  const createNote = useCreateQuickNote();
  const deleteNote = useDeleteQuickNote();
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    createNote.mutate({ body: text.trim() });
    setText("");
    setAdding(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Notes</CardTitle>
        <CardAction>
          <Button size="icon-sm" variant="outline" onClick={() => setAdding((a) => !a)} aria-label="Add note">
            <Plus className="size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Input
              autoFocus
              placeholder="Jot something down…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
        )}

        <QueryBoundary
          isLoading={notesQuery.isLoading}
          isError={notesQuery.isError}
          error={notesQuery.error}
          onRetry={() => notesQuery.refetch()}
        >
          {!notesQuery.data || notesQuery.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {notesQuery.data.map((note) => (
                <li key={note.id} className="group flex items-start gap-2 text-sm">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="min-w-0 flex-1 break-words">{note.body}</span>
                  <button
                    type="button"
                    onClick={() => deleteNote.mutate(note.id)}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                    aria-label="Delete note"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}
