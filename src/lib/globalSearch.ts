import type { Context, InboxItem, Item, Note, PersonalRecord, QuickNote } from "@/types";

export type SearchResultType = "item" | "context" | "note" | "quickNote" | "inbox" | "record";

export interface SearchResult {
  key: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  path: string;
  category: Item["category"] | null;
  haystack: string;
}

export const SEARCH_GROUP_LABEL: Record<SearchResultType, string> = {
  item: "Tasks",
  context: "Classes, Projects & Programs",
  note: "Notes",
  quickNote: "Quick Notes",
  inbox: "Inbox",
  record: "Gym Records",
};

function contextPath(context: Context): string {
  switch (context.type) {
    case "Class":
      return `/school/${context.id}`;
    case "Project":
      return "/work";
    case "Program":
      return "/gym";
  }
}

function itemPath(item: Item): string {
  if (item.category === "School") {
    return item.subcategory_id ? `/school/${item.subcategory_id}` : "/school";
  }
  if (item.category === "Work") return "/work";
  if (item.category === "Gym") return "/gym";
  if (item.category === "Personal") return "/personal";
  return "/master-list";
}

function normalize(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export interface GlobalSearchSources {
  items: Item[];
  contexts: Context[];
  notes: Note[];
  quickNotes: QuickNote[];
  inboxItems: InboxItem[];
  records: PersonalRecord[];
}

export function buildSearchIndex(sources: GlobalSearchSources): SearchResult[] {
  const contextsById = new Map(sources.contexts.map((c) => [c.id, c]));
  const results: SearchResult[] = [];

  for (const item of sources.items) {
    if (item.deleted_at) continue;
    results.push({
      key: `item:${item.id}`,
      type: "item",
      title: item.title,
      subtitle: [item.category, item.due_date].filter(Boolean).join(" · ") || null,
      path: itemPath(item),
      category: item.category,
      haystack: normalize(item.title, item.description, item.notes, item.category, item.tags?.join(" ")),
    });
  }

  for (const context of sources.contexts) {
    results.push({
      key: `context:${context.id}`,
      type: "context",
      title: context.name,
      subtitle: [context.type, context.term ?? context.owner].filter(Boolean).join(" · ") || null,
      path: contextPath(context),
      category: null,
      haystack: normalize(context.name, context.type, context.term, context.owner, context.schedule),
    });
  }

  for (const note of sources.notes) {
    const owner = contextsById.get(note.context_id) ?? null;
    results.push({
      key: `note:${note.id}`,
      type: "note",
      title: note.body.slice(0, 80),
      subtitle: owner ? `Note on ${owner.name}` : "Note",
      path: owner ? contextPath(owner) : "/master-list",
      category: null,
      haystack: normalize(note.body, owner?.name),
    });
  }

  for (const qn of sources.quickNotes) {
    results.push({
      key: `quickNote:${qn.id}`,
      type: "quickNote",
      title: qn.body.slice(0, 80),
      subtitle: "Quick note",
      path: "/inbox",
      category: null,
      haystack: normalize(qn.body),
    });
  }

  for (const inboxItem of sources.inboxItems) {
    results.push({
      key: `inbox:${inboxItem.id}`,
      type: "inbox",
      title: inboxItem.title,
      subtitle: "Inbox",
      path: "/inbox",
      category: null,
      haystack: normalize(inboxItem.title, inboxItem.notes),
    });
  }

  for (const record of sources.records) {
    results.push({
      key: `record:${record.id}`,
      type: "record",
      title: `${record.exercise_name} — ${record.value}${record.unit ?? ""}`,
      subtitle: "Personal record",
      path: "/gym",
      category: null,
      haystack: normalize(record.exercise_name, record.unit),
    });
  }

  return results;
}

const MAX_RESULTS = 40;

export function searchIndex(index: SearchResult[], rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const scored = index
    .map((result) => {
      const titleLower = result.title.toLowerCase();
      let score: number;
      if (titleLower === query) score = 0;
      else if (titleLower.startsWith(query)) score = 1;
      else if (titleLower.includes(query)) score = 2;
      else if (result.haystack.includes(query)) score = 3;
      else score = -1;
      return { result, score };
    })
    .filter((r) => r.score >= 0)
    .sort((a, b) => a.score - b.score || a.result.title.length - b.result.title.length);

  return scored.slice(0, MAX_RESULTS).map((r) => r.result);
}
