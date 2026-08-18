import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QueryBoundary } from "@/components/QueryBoundary";
import {
  useCalendarEventsInRangeForCalendars,
  useCalendarList,
  useGoogleConnected,
  useSyncNow,
  useUpcomingCalendarEvents,
} from "@/hooks/useGoogle";
import { useItems } from "@/hooks/useItems";
import { usePreferences } from "@/hooks/usePreferences";
import {
  addDays,
  addMonths,
  formatHourLabel,
  formatMonthRange,
  formatMonthYear,
  getMonthGrid,
  getWeekDays,
  HOUR_GRID_END,
  HOUR_GRID_START,
  HOUR_ROW_HEIGHT,
  isSameDay,
  minutesFromTimeString,
  parseDateOnly,
  toDateKey,
  WEEKDAY_SHORT_LABELS,
} from "@/lib/calendarGrid";
import { CATEGORY_BORDER_CLASS, CATEGORY_COLORS } from "@/lib/categoryColors";
import { parseSelectedCalendarIds, SELECTED_CALENDARS_PREF_KEY } from "@/lib/googleCalendarSelection";
import { cn } from "@/lib/utils";
import type { GoogleCalendarEvent, Item } from "@/types";

type ViewMode = "month" | "week";
type EventFilter = "all" | "shared" | "items" | "completed";

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "shared", label: "Shared" },
  { value: "items", label: "My Items" },
  { value: "completed", label: "Completed" },
];

const DEFAULT_DURATION_MINUTES = 60;

// A day cell mixes two different kinds of things — local Items (due_date,
// have a category/status) and Google Calendar events pulled live for the
// visible range, from the primary calendar and any other/shared calendars
// selected in Settings (no local status, may not exist as an Item at all if
// they were created directly in Google Calendar) — this is the shape both
// get flattened into so they can share one sorted list.
interface DayEntry {
  key: string;
  title: string;
  time: string | null; // "HH:MM", or null for all-day
  durationMinutes: number;
  source: { kind: "item"; item: Item } | { kind: "google"; color: string | null; isPrimary: boolean };
}

function eventWhen(start: { date: string | null; dateTime: string | null } | null): string {
  if (!start) return "—";
  if (start.dateTime) return start.dateTime.slice(0, 16).replace("T", " ");
  return start.date ?? "—";
}

function googleEventDateKey(event: GoogleCalendarEvent): string | null {
  const start = event.start;
  if (!start) return null;
  if (start.date) return start.date; // already "YYYY-MM-DD" — same format toDateKey produces
  if (start.dateTime) return toDateKey(new Date(start.dateTime)); // carries a real offset, safe to construct directly
  return null;
}

function googleEventTime(event: GoogleCalendarEvent): string | null {
  return event.start?.dateTime ? event.start.dateTime.slice(11, 16) : null;
}

function googleEventDurationMinutes(event: GoogleCalendarEvent): number {
  if (!event.start?.dateTime || !event.end?.dateTime) return DEFAULT_DURATION_MINUTES;
  const minutes = Math.round(
    (new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60_000,
  );
  return minutes > 0 ? minutes : DEFAULT_DURATION_MINUTES;
}

// All-day entries first, then timed ones ascending — the usual day-cell ordering convention.
function sortForDay(entries: DayEntry[]): DayEntry[] {
  return [...entries].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return -1;
    if (!b.time) return 1;
    return a.time.localeCompare(b.time);
  });
}

// Colored chip styling shared by the Month grid's cells and Week grid's
// all-day row/timed blocks — Items use their category's pastel color,
// Google-only events (no local Item) use the source calendar's own color
// from Google, falling back to a neutral tone if Google didn't supply one.
function entryColorProps(entry: DayEntry): { className: string; style?: CSSProperties } {
  if (entry.source.kind === "item") {
    return {
      className: cn(
        "border-l-[3px]",
        CATEGORY_COLORS[entry.source.item.category],
        CATEGORY_BORDER_CLASS[entry.source.item.category],
      ),
    };
  }
  const color = entry.source.color;
  return {
    className: "border-l-[3px] border-l-slate-400 bg-muted/70 text-foreground",
    style: color ? { borderLeftColor: color } : undefined,
  };
}

function EntryPill({ entry }: { entry: DayEntry }) {
  const item = entry.source.kind === "item" ? entry.source.item : null;
  const tooltip = item
    ? `${item.title}${item.due_time ? ` at ${item.due_time}` : ""} (${item.category}, ${item.status})`
    : `${entry.title}${entry.time ? ` at ${entry.time}` : ""} (Google Calendar)`;
  const colorProps = entryColorProps(entry);

  return (
    <div
      title={tooltip}
      style={colorProps.style}
      className={cn(
        "truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
        colorProps.className,
        item?.status === "Completed" && "text-muted-foreground line-through opacity-70",
      )}
    >
      {entry.time && <span className="mr-1 tabular-nums opacity-70">{entry.time}</span>}
      {entry.title}
    </div>
  );
}

const MONTH_CELL_LIMIT = 3;

function MonthGrid({ anchor, entriesByDay }: { anchor: Date; entriesByDay: Map<string, DayEntry[]> }) {
  const weeks = useMemo(() => getMonthGrid(anchor), [anchor]);
  const today = new Date();

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_SHORT_LABELS.map((label) => (
          <div key={label} className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day) => {
            const key = toDateKey(day);
            const dayEntries = sortForDay(entriesByDay.get(key) ?? []);
            const inMonth = day.getMonth() === anchor.getMonth();
            const isToday = isSameDay(day, today);
            return (
              <div
                key={key}
                className={cn(
                  "min-h-24 border-b border-r p-1 last:border-r-0",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div
                  className={cn(
                    "mb-1 inline-flex size-5 items-center justify-center rounded-full text-xs",
                    isToday && "bg-primary text-primary-foreground font-medium",
                    !inMonth && !isToday && "text-muted-foreground",
                  )}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEntries.slice(0, MONTH_CELL_LIMIT).map((entry) => (
                    <EntryPill key={entry.key} entry={entry} />
                  ))}
                  {dayEntries.length > MONTH_CELL_LIMIT && (
                    <p className="px-1 text-xs text-muted-foreground">
                      +{dayEntries.length - MONTH_CELL_LIMIT} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface PositionedEntry {
  entry: DayEntry;
  top: number;
  height: number;
  column: number;
  columnCount: number;
}

// Greedy interval-partitioning so simultaneous events get side-by-side lanes
// instead of fully overlapping. Not a precise per-overlap-cluster width —
// every timed entry in the day shares one lane count — but that's a fair
// trade for a personal calendar where true simultaneous conflicts are rare,
// versus tracking per-cluster width.
function layoutColumns(entries: DayEntry[]): PositionedEntry[] {
  const withRange = entries
    .filter((e): e is DayEntry & { time: string } => e.time !== null)
    .map((e) => ({ entry: e, start: minutesFromTimeString(e.time), end: minutesFromTimeString(e.time) + e.durationMinutes }))
    .sort((a, b) => a.start - b.start);

  const columnEnds: number[] = []; // end time currently occupying each column
  const placed: { entry: DayEntry; start: number; end: number; column: number }[] = [];

  for (const item of withRange) {
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    placed.push({ ...item, column });
  }

  const columnCount = Math.max(1, columnEnds.length);
  const gridStart = HOUR_GRID_START * 60;
  const gridEnd = HOUR_GRID_END * 60;

  return placed.map((p) => {
    const clampedStart = Math.min(Math.max(p.start, gridStart), gridEnd);
    const clampedEnd = Math.min(Math.max(p.end, clampedStart + 20), gridEnd);
    const top = ((clampedStart - gridStart) / 60) * HOUR_ROW_HEIGHT;
    const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_ROW_HEIGHT, 22);
    return { entry: p.entry, top, height, column: p.column, columnCount };
  });
}

function HourEventBlock({ positioned }: { positioned: PositionedEntry }) {
  const { entry, top, height, column, columnCount } = positioned;
  const item = entry.source.kind === "item" ? entry.source.item : null;
  const colorProps = entryColorProps(entry);
  const widthPct = 100 / columnCount;

  return (
    <div
      title={entry.title}
      style={{
        top,
        height,
        left: `${column * widthPct}%`,
        width: `calc(${widthPct}% - 4px)`,
        ...colorProps.style,
      }}
      className={cn(
        "absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs leading-tight",
        colorProps.className,
        item?.status === "Completed" && "text-muted-foreground line-through opacity-70",
      )}
    >
      <p className="truncate font-medium">{entry.title}</p>
      {entry.time && <p className="truncate opacity-70">{entry.time}</p>}
    </div>
  );
}

const HOURS = Array.from({ length: HOUR_GRID_END - HOUR_GRID_START }, (_, i) => HOUR_GRID_START + i);

// Ticks once a minute so the "now" line in the week view keeps drifting down
// through the day while the app sits open, instead of freezing at mount time.
function useNowTick(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function WeekHourGrid({ anchor, entriesByDay }: { anchor: Date; entriesByDay: Map<string, DayEntry[]> }) {
  const days = useMemo(() => getWeekDays(anchor), [anchor]);
  const today = useNowTick();
  const gridHeight = HOURS.length * HOUR_ROW_HEIGHT;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = ((nowMinutes - HOUR_GRID_START * 60) / 60) * HOUR_ROW_HEIGHT;
  const nowInGrid = nowMinutes >= HOUR_GRID_START * 60 && nowMinutes <= HOUR_GRID_END * 60;

  const dayData = useMemo(
    () =>
      days.map((day) => {
        const key = toDateKey(day);
        const all = entriesByDay.get(key) ?? [];
        return { day, key, allDay: all.filter((e) => e.time === null), timed: layoutColumns(all) };
      }),
    [days, entriesByDay],
  );

  const hasAllDay = dayData.some((d) => d.allDay.length > 0);

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-muted/40">
        <div />
        {dayData.map(({ day, key }) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={key} className="border-l px-2 py-1.5 text-center">
              <p className="text-xs font-medium text-muted-foreground">
                {day.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{day.getDate()}</p>
            </div>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b">
          <div className="px-1 py-1 text-right text-[0.65rem] text-muted-foreground">All day</div>
          {dayData.map(({ key, allDay }) => (
            <div key={key} className="space-y-0.5 border-l p-1">
              {allDay.map((entry) => (
                <EntryPill key={entry.key} entry={entry} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              style={{ height: HOUR_ROW_HEIGHT }}
              className="-translate-y-2 pr-2 text-right text-xs text-muted-foreground"
            >
              {formatHourLabel(hour)}
            </div>
          ))}
        </div>
        {dayData.map(({ day, key, timed }) => (
          <div key={key} className="relative border-l" style={{ height: gridHeight }}>
            {HOURS.map((hour, i) => (
              <div key={hour} className="absolute inset-x-0 border-b" style={{ top: i * HOUR_ROW_HEIGHT }} />
            ))}
            {timed.map((positioned) => (
              <HourEventBlock key={positioned.entry.key} positioned={positioned} />
            ))}
            {nowInGrid && isSameDay(day, today) && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: nowTop }}
              >
                <span className="-ml-[3px] size-[7px] shrink-0 rounded-full bg-destructive" />
                <div className="h-px flex-1 bg-destructive" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleAgendaSection() {
  const { data: connected, isLoading: connLoading } = useGoogleConnected();
  const eventsQuery = useUpcomingCalendarEvents(!!connected);
  const syncNow = useSyncNow();

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Google Calendar (upcoming)</h2>
          {connected && (
            <Button size="sm" variant="outline" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
              {syncNow.isPending ? "Syncing…" : "Sync Now"}
            </Button>
          )}
        </div>

        {connLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !connected ? (
          <p className="text-sm text-muted-foreground">
            Not connected to Google Calendar.{" "}
            <Link to="/settings" className="underline">
              Connect in Settings
            </Link>
            .
          </p>
        ) : (
          <QueryBoundary
            isLoading={eventsQuery.isLoading}
            isError={eventsQuery.isError}
            error={eventsQuery.error}
            onRetry={() => eventsQuery.refetch()}
          >
            {!eventsQuery.data || eventsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing upcoming.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {eventsQuery.data.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 p-2 text-sm">
                    <span className="flex-1">{event.summary ?? "(untitled)"}</span>
                    <span className="text-xs text-muted-foreground">{eventWhen(event.start)}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        )}
      </CardContent>
    </Card>
  );
}

// A real week/month grid mixing local Items (by due_date) with actual Google
// Calendar events fetched live for the visible range — not just items this
// app itself created. The section below is a separate, always-"next 10 from
// now" agenda regardless of which period is being viewed (spec §6.8's
// original read-only preview); item creation/editing happens elsewhere.
export default function CalendarPage() {
  const { data: items } = useItems();
  const { data: connected } = useGoogleConnected();
  const { data: calendars, isError: calendarListError } = useCalendarList(!!connected);
  const { data: prefs } = usePreferences();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filter, setFilter] = useState<EventFilter>("all");
  const [anchor, setAnchor] = useState(() => new Date());

  const weeks = useMemo(() => getMonthGrid(anchor), [anchor]);
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const rangeStart = viewMode === "month" ? weeks[0][0] : weekDays[0];
  const rangeEnd = viewMode === "month" ? weeks[weeks.length - 1][6] : weekDays[6];
  const timeMin = rangeStart.toISOString();
  const timeMax = addDays(rangeEnd, 1).toISOString(); // exclusive upper bound, so the last day's own events are included

  const selectedCalendarIds = useMemo(
    () => parseSelectedCalendarIds(prefs?.[SELECTED_CALENDARS_PREF_KEY]),
    [prefs],
  );

  const primaryCalendarId = useMemo(() => calendars?.find((c) => c.primary)?.id ?? null, [calendars]);

  // The primary calendar is always included, whatever else is selected in
  // Settings — before the calendar list itself has loaded, fall back to the
  // "primary" alias alone so events don't briefly disappear during that fetch.
  const calendarIdsToQuery = useMemo(() => {
    if (!connected) return [];
    if (!calendars || calendars.length === 0) return ["primary"];
    const ids = new Set<string>([primaryCalendarId ?? "primary"]);
    for (const id of selectedCalendarIds) ids.add(id);
    return Array.from(ids);
  }, [connected, calendars, primaryCalendarId, selectedCalendarIds]);

  const colorByCalendarId = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const cal of calendars ?? []) map.set(cal.id, cal.background_color ?? null);
    return map;
  }, [calendars]);

  const eventQueries = useCalendarEventsInRangeForCalendars(
    calendarIdsToQuery,
    timeMin,
    timeMax,
    !!connected,
  );
  const eventsQueryError = eventQueries.find((q) => q.isError)?.error;

  // Items already pushed to Google show up in the range fetch too (as the
  // same underlying event) — skip those so they don't render twice.
  const knownGoogleCalendarIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of items ?? []) {
      if (item.google_calendar_id) set.add(item.google_calendar_id);
    }
    return set;
  }, [items]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (key: string, entry: DayEntry) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    };

    for (const item of items ?? []) {
      if (!item.due_date) continue;
      push(toDateKey(parseDateOnly(item.due_date)), {
        key: `item-${item.id}`,
        title: item.title,
        time: item.due_time,
        durationMinutes: item.estimated_duration ?? DEFAULT_DURATION_MINUTES,
        source: { kind: "item", item },
      });
    }

    eventQueries.forEach((query, i) => {
      const calendarId = calendarIdsToQuery[i];
      const color = colorByCalendarId.get(calendarId) ?? null;
      const isPrimary = primaryCalendarId ? calendarId === primaryCalendarId : calendarId === "primary";
      for (const event of (query.data as GoogleCalendarEvent[] | undefined) ?? []) {
        if (event.status === "cancelled") continue;
        if (knownGoogleCalendarIds.has(event.id)) continue;
        const key = googleEventDateKey(event);
        if (!key) continue;
        push(key, {
          key: `gcal-${calendarId}-${event.id}`,
          title: event.summary ?? "(untitled)",
          time: googleEventTime(event),
          durationMinutes: googleEventDurationMinutes(event),
          source: { kind: "google", color, isPrimary },
        });
      }
    });

    return map;
  }, [items, eventQueries, calendarIdsToQuery, colorByCalendarId, primaryCalendarId, knownGoogleCalendarIds]);

  // The tabs row above the grid narrows which entries render, without
  // re-fetching anything — "Shared" reuses the same primary/non-primary
  // distinction the Settings page's calendar picker introduced.
  const filteredEntriesByDay = useMemo(() => {
    if (filter === "all") return entriesByDay;
    const predicate = (e: DayEntry): boolean => {
      if (filter === "shared") return e.source.kind === "google" && !e.source.isPrimary;
      if (filter === "items") return e.source.kind === "item";
      return e.source.kind === "item" && e.source.item.status === "Completed";
    };
    const map = new Map<string, DayEntry[]>();
    for (const [key, list] of entriesByDay) {
      const filtered = list.filter(predicate);
      if (filtered.length > 0) map.set(key, filtered);
    }
    return map;
  }, [entriesByDay, filter]);

  const goToday = () => setAnchor(new Date());
  const goPrev = () => setAnchor((a) => (viewMode === "month" ? addMonths(a, -1) : addDays(a, -7)));
  const goNext = () => setAnchor((a) => (viewMode === "month" ? addMonths(a, 1) : addDays(a, 7)));

  const today = new Date();
  const todayMonthAbbrev = today.toLocaleDateString(undefined, { month: "short" }).toUpperCase();

  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-semibold">Calendar</h1>

      <div className="flex w-fit gap-1 rounded-lg bg-muted/50 p-1">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              filter === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <div className="flex w-14 shrink-0 flex-col items-center rounded-md border bg-muted/40 py-1 leading-none">
            <span className="text-[0.6rem] font-semibold text-muted-foreground">{todayMonthAbbrev}</span>
            <span className="text-lg font-bold">{today.getDate()}</span>
          </div>
          <div>
            <p className="text-lg font-semibold">{formatMonthYear(anchor)}</p>
            <p className="text-xs text-muted-foreground">{formatMonthRange(anchor)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button size="icon-sm" variant="ghost" onClick={goPrev} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={goToday}>
              Today
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={goNext} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={viewMode === "month" ? "default" : "outline"} onClick={() => setViewMode("month")}>
              Month
            </Button>
            <Button size="sm" variant={viewMode === "week" ? "default" : "outline"} onClick={() => setViewMode("week")}>
              Week
            </Button>
          </div>
        </div>
      </div>

      {connected && calendarListError && (
        <p className="text-sm text-destructive">
          Couldn't load your list of Google Calendars, so only your primary calendar is shown.
          This usually means the connection needs to be refreshed — try disconnecting and
          reconnecting Google in{" "}
          <Link to="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      )}

      {connected && eventsQueryError && (
        <p className="text-sm text-destructive">
          Couldn't load Google Calendar events for this range: {String(eventsQueryError)}
        </p>
      )}

      {viewMode === "month" ? (
        <MonthGrid anchor={anchor} entriesByDay={filteredEntriesByDay} />
      ) : (
        <WeekHourGrid anchor={anchor} entriesByDay={filteredEntriesByDay} />
      )}

      <GoogleAgendaSection />
    </div>
  );
}
