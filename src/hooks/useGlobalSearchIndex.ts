import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { commands } from "@/lib/commands";
import { buildSearchIndex, type SearchResult } from "@/lib/globalSearch";
import { useContexts } from "@/hooks/useContexts";
import { useItems } from "@/hooks/useItems";
import { useQuickNotes } from "@/hooks/useQuickNotes";
import { useInboxItems } from "@/hooks/useInbox";
import { usePersonalRecords } from "@/hooks/usePersonalRecords";
import type { Note } from "@/types";

// Notes are stored per-context in the backend (list_notes_for_context), so a
// unified index has to fan out across every context rather than call one
// "list all notes" endpoint that doesn't exist yet.
export function useGlobalSearchIndex(): { index: SearchResult[]; isLoading: boolean } {
  const { data: items = [], isLoading: itemsLoading } = useItems();
  const { data: contexts = [], isLoading: contextsLoading } = useContexts();
  const { data: quickNotes = [], isLoading: quickNotesLoading } = useQuickNotes();
  const { data: inboxItems = [], isLoading: inboxLoading } = useInboxItems();
  const { data: records = [], isLoading: recordsLoading } = usePersonalRecords();

  const noteQueries = useQueries({
    queries: contexts.map((context) => ({
      queryKey: ["notes", context.id],
      queryFn: () => commands.listNotesForContext(context.id),
    })),
  });

  const notes = useMemo<Note[]>(() => noteQueries.flatMap((q) => q.data ?? []), [noteQueries]);
  const notesLoading = contexts.length > 0 && noteQueries.some((q) => q.isLoading);

  const index = useMemo(
    () => buildSearchIndex({ items, contexts, notes, quickNotes, inboxItems, records }),
    [items, contexts, notes, quickNotes, inboxItems, records],
  );

  return {
    index,
    isLoading:
      itemsLoading || contextsLoading || quickNotesLoading || inboxLoading || recordsLoading || notesLoading,
  };
}
