import { Fragment, useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryBadge } from "@/components/CategoryBadge";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useContexts } from "@/hooks/useContexts";
import { useItems, useUpdateItem } from "@/hooks/useItems";
import { assignmentRowClass, COMPLETED_TEXT_CLASS } from "@/lib/classColors";
import { NEXT_STATUS } from "@/lib/itemStatus";
import { daysUntil, SAVED_VIEWS } from "@/lib/masterListViews";
import { cn } from "@/lib/utils";
import { type GroupBy, useMasterListStore } from "@/store/masterListStore";
import type { Category, Item } from "@/types";

interface Row {
  item: Item;
  contextName: string | null;
  contextColor: string | null;
  daysUntilDue: number | null;
}

export default function MasterList() {
  const { data: items, isLoading, isError, error, refetch } = useItems();
  const { data: contexts } = useContexts();
  const updateItem = useUpdateItem();
  const { activeViewId, search, groupBy, setActiveView, setSearch, setGroupBy } =
    useMasterListStore();
  const [sorting, setSorting] = useState<SortingState>([]);

  const contextNameById = useMemo(() => {
    const map = new Map<string, string>();
    contexts?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [contexts]);

  const contextColorById = useMemo(() => {
    const map = new Map<string, string | null>();
    contexts?.forEach((c) => map.set(c.id, c.color));
    return map;
  }, [contexts]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        accessorFn: (r) => r.item.title,
        cell: (ctx) => (
          <span className={ctx.row.original.item.status === "Completed" ? COMPLETED_TEXT_CLASS : ""}>
            {ctx.getValue<string>()}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        accessorFn: (r) => r.item.category,
        cell: (ctx) => <CategoryBadge category={ctx.getValue<Category>()} />,
      },
      { id: "subcategory", header: "Subcategory/Context", accessorFn: (r) => r.contextName ?? "—" },
      { id: "due_date", header: "Due Date", accessorFn: (r) => r.item.due_date ?? "—" },
      { id: "due_time", header: "Due Time", accessorFn: (r) => r.item.due_time ?? "—" },
      { id: "priority", header: "Priority", accessorFn: (r) => r.item.priority },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => r.item.status,
        cell: (ctx) => {
          const item = ctx.row.original.item;
          return (
            <button
              className="text-xs underline"
              onClick={() => updateItem.mutate({ ...item, status: NEXT_STATUS[item.status] })}
            >
              {item.status}
            </button>
          );
        },
      },
      {
        id: "estimated_duration",
        header: "Est. Duration",
        accessorFn: (r) => r.item.estimated_duration,
        cell: (ctx) => {
          const value = ctx.getValue<number | null>();
          return value != null ? `${value}m` : "—";
        },
      },
      {
        id: "tags",
        header: "Tags",
        accessorFn: (r) => r.item.tags?.join(", ") || "—",
      },
      { id: "days_until_due", header: "Days Until Due", accessorFn: (r) => r.daysUntilDue ?? "—" },
      {
        id: "gcal",
        header: "Google Calendar",
        accessorFn: (r) => (r.item.google_calendar_id ? "Synced" : "Not synced"),
      },
      {
        id: "gtasks",
        header: "Google Tasks",
        accessorFn: (r) => (r.item.google_task_id ? "Synced" : "Not synced"),
      },
    ],
    [updateItem],
  );

  const rows: Row[] = useMemo(() => {
    if (!items) return [];
    const activeView = SAVED_VIEWS.find((v) => v.id === activeViewId);
    return items
      .filter((item) => !activeView || activeView.predicate(item))
      .filter(
        (item) => !search || item.title.toLowerCase().includes(search.toLowerCase()),
      )
      .map((item) => ({
        item,
        contextName: item.subcategory_id
          ? (contextNameById.get(item.subcategory_id) ?? null)
          : item.subcategory_text,
        contextColor: item.subcategory_id ? (contextColorById.get(item.subcategory_id) ?? null) : null,
        daysUntilDue: daysUntil(item.due_date),
      }));
  }, [items, activeViewId, search, contextNameById, contextColorById]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: null as string | null, rows: tableRows }];
    const map = new Map<string, typeof tableRows>();
    for (const r of tableRows) {
      const key = groupBy === "category" ? r.original.item.category : r.original.item.status;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([key, groupRows]) => ({ key, rows: groupRows }));
  }, [tableRows, groupBy]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h1 className="mr-2 text-xl font-semibold">Master List</h1>
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="Search titles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {SAVED_VIEWS.map((view) => (
            <Button
              key={view.id}
              size="sm"
              variant={activeViewId === view.id ? "default" : "outline"}
              onClick={() => setActiveView(view.id)}
            >
              {view.label}
            </Button>
          ))}
        </div>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="ml-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="category">Group by Category</SelectItem>
            <SelectItem value="status">Group by Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items match this view.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer whitespace-nowrap border-b px-2 py-1 text-left font-medium select-none"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ▲", desc: " ▼" }[header.column.getIsSorted() as string] ?? ""}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.key ?? "__all__"}>
                  {group.key !== null && (
                    <tr className="bg-muted/50">
                      <td colSpan={columns.length} className="px-2 py-1 font-medium">
                        {group.key} ({group.rows.length})
                      </td>
                    </tr>
                  )}
                  {group.rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b hover:brightness-95",
                        assignmentRowClass(row.original.contextColor, row.original.item.status),
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="whitespace-nowrap px-2 py-1">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        </QueryBoundary>
      </div>
    </div>
  );
}
