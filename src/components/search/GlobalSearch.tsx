import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dumbbell, FileText, Inbox, Layers, ListTodo, Search, StickyNote } from "lucide-react";
import { useGlobalSearchIndex } from "@/hooks/useGlobalSearchIndex";
import { useSearchStore } from "@/store/searchStore";
import { CategoryBadge } from "@/components/CategoryBadge";
import { cn } from "@/lib/utils";
import { SEARCH_GROUP_LABEL, searchIndex, type SearchResult, type SearchResultType } from "@/lib/globalSearch";

const TYPE_ICON: Record<SearchResultType, typeof Search> = {
  item: ListTodo,
  context: Layers,
  note: StickyNote,
  quickNote: FileText,
  inbox: Inbox,
  record: Dumbbell,
};

function groupResults(results: SearchResult[]): [SearchResultType, SearchResult[]][] {
  const groups = new Map<SearchResultType, SearchResult[]>();
  for (const result of results) {
    const bucket = groups.get(result.type);
    if (bucket) bucket.push(result);
    else groups.set(result.type, [result]);
  }
  return Array.from(groups.entries());
}

export function GlobalSearch() {
  const { isOpen, open, close } = useSearchStore();
  const { index } = useGlobalSearchIndex();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const grouped = useMemo(() => groupResults(results), [results]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isShortcut) {
        e.preventDefault();
        open();
      } else if (e.key === "Escape" && isOpen) {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, open, close]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => setActiveIndex(0), [query]);

  function select(result: SearchResult) {
    navigate(result.path);
    close();
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const result = results[activeIndex];
      if (result) select(result);
    }
  }

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-md border border-[color:var(--glass-border)] bg-sidebar/90 shadow-[0_24px_64px_-16px_var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--glass-border)] px-4 py-3">
          <Search className="size-4 shrink-0 text-sidebar-foreground/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search everything — tasks, notes, classes, projects, gym records…"
            className="w-full bg-transparent text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-[color:var(--glass-border)] px-1.5 py-0.5 text-[10px] text-sidebar-foreground/50">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {query.trim() === "" ? (
            <p className="px-2 py-6 text-center text-sm text-sidebar-foreground/50">
              Type to search across your entire dashboard.
            </p>
          ) : results.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-sidebar-foreground/50">
              No results for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            grouped.map(([type, items]) => {
              const Icon = TYPE_ICON[type];
              return (
                <div key={type} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-sidebar-foreground/45">
                    {SEARCH_GROUP_LABEL[type]}
                  </div>
                  {items.map((result) => {
                    flatIndex += 1;
                    const active = flatIndex === activeIndex;
                    return (
                      <button
                        key={result.key}
                        type="button"
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => select(result)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/85 hover:bg-sidebar-accent/40",
                        )}
                      >
                        <Icon className="size-4 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{result.title}</span>
                        {result.category && <CategoryBadge category={result.category} className="shrink-0" />}
                        {result.subtitle && !result.category && (
                          <span className="shrink-0 truncate text-xs text-sidebar-foreground/50">
                            {result.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
