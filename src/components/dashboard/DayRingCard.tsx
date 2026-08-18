import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateItem, useSoftDeleteItem, useUpdateItem } from "@/hooks/useItems";
import { useNowTick } from "@/hooks/useNowTick";
import { usePreferences, useSetPreference } from "@/hooks/usePreferences";
import { minutesFromTimeString, minutesToTimeString, toDateKey } from "@/lib/calendarGrid";
import { CATEGORY_HEX } from "@/lib/categoryColors";
import {
  ADD_BLOCK_DURATION_MINUTES,
  angleToMinute,
  arcPath,
  buildHourTicks,
  buildInitialBlocks,
  DEFAULT_SLEEP_BEDTIME,
  DEFAULT_SLEEP_WAKE,
  easeOutBack,
  fmtDur,
  fmtTime,
  moveBlock,
  neighborLimits,
  openMinutes,
  pointOnRing,
  RING_CENTER,
  RING_RADIUS,
  setEdge,
  SLEEP_BEDTIME_PREF_KEY,
  SLEEP_WAKE_PREF_KEY,
  snapMinutes,
  unwrapNear,
  type RingBlock,
} from "@/lib/dayRing";
import { cn } from "@/lib/utils";
import type { Category, Item } from "@/types";

const ADD_CATEGORY_CHOICES: { category: Category; label: string }[] = [
  { category: "School", label: "Study" },
  { category: "Work", label: "Work" },
  { category: "Gym", label: "Gym" },
  { category: "Personal", label: "Personal" },
];

const HOUR_TICKS = buildHourTicks();
const SPRING_MS = 220;

type DragState =
  | { kind: "edge"; blockId: string; edge: "start" | "end"; startClient: { x: number; y: number }; moved: boolean }
  | {
      kind: "move";
      blockId: string;
      startClient: { x: number; y: number };
      moved: boolean;
      initStart: number;
      initEnd: number;
      initRawUnwrapped: number;
    };

interface AddPopoverState {
  x: number;
  y: number;
  gapIndex: number;
  start: number;
  duration: number;
}

function blockColor(block: RingBlock): string {
  return block.kind === "sleep" ? "var(--day-ring-sleep)" : CATEGORY_HEX[block.category!];
}

// A single day, 24h ring — Sleep anchors it (a preference, not an Item),
// the rest of today's timed Items fill the waking hours, and whatever isn't
// covered reads as open. Drag a dot to resize the block on either side, drag
// the middle of a block to move it, or click open track to add one. See the
// "Day Ring" mockup this was built from for the full interaction rationale.
export function DayRingCard({ items }: { items: Item[] }) {
  const prefsQuery = usePreferences();
  const setPreference = useSetPreference();
  const updateItem = useUpdateItem();
  const createItem = useCreateItem();
  const softDeleteItem = useSoftDeleteItem();
  const now = useNowTick(30_000);

  const bedtime = prefsQuery.data?.[SLEEP_BEDTIME_PREF_KEY] ?? DEFAULT_SLEEP_BEDTIME;
  const wake = prefsQuery.data?.[SLEEP_WAKE_PREF_KEY] ?? DEFAULT_SLEEP_WAKE;

  const [blocks, setBlocks] = useState<RingBlock[]>(() => buildInitialBlocks(items, bedtime, wake));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pulse, setPulse] = useState<{ id: string; mode: "scale" | "flash" } | null>(null);
  const [addPopover, setAddPopover] = useState<AddPopoverState | null>(null);

  const blocksRef = useRef(blocks);
  const draggingRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // Resync from source data (items/prefs changed, e.g. after a mutation's
  // refetch) — but never mid-gesture, or the block would jump under the
  // user's pointer.
  useEffect(() => {
    if (draggingRef.current) return;
    setBlocks(buildInitialBlocks(items, bedtime, wake));
  }, [items, bedtime, wake]);

  useEffect(() => {
    if (!pulse) return;
    const id = setTimeout(() => setPulse(null), 220);
    return () => clearTimeout(id);
  }, [pulse]);

  useEffect(() => {
    if (!addPopover) return;
    function onPointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setAddPopover(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [addPopover]);

  function clientToMinute(clientX: number, clientY: number): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const theta = Math.atan2(loc.y - RING_CENTER, loc.x - RING_CENTER);
    return angleToMinute(theta);
  }

  function persistBlock(blockId: string) {
    const block = blocksRef.current.find((b) => b.id === blockId);
    if (!block) return;
    if (block.kind === "sleep") {
      setPreference.mutate({ key: SLEEP_BEDTIME_PREF_KEY, value: minutesToTimeString(block.start) });
      setPreference.mutate({ key: SLEEP_WAKE_PREF_KEY, value: minutesToTimeString(block.end) });
    } else if (block.item) {
      updateItem.mutate({
        ...block.item,
        due_time: minutesToTimeString(block.start),
        estimated_duration: block.end - block.start,
      });
    }
  }

  function runSpring(blockId: string, target: { start: number; end: number }, onDone: () => void) {
    const from = blocksRef.current.find((b) => b.id === blockId);
    if (!from) return;
    const fromStart = from.start, fromEnd = from.end;
    const t0 = performance.now();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function frame(now: number) {
      const t = reduceMotion ? 1 : Math.min(1, (now - t0) / SPRING_MS);
      const e = easeOutBack(t);
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, start: fromStart + (target.start - fromStart) * e, end: fromEnd + (target.end - fromEnd) * e }
            : b,
        ),
      );
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, ...target } : b)));
        onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  function selectBlock(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  // ---- edge (resize) drag ----
  function onHandlePointerDown(e: React.PointerEvent, blockId: string, edge: "start" | "end") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    dragRef.current = { kind: "edge", blockId, edge, startClient: { x: e.clientX, y: e.clientY }, moved: false };
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "edge") return;
    if (Math.abs(e.clientX - drag.startClient.x) + Math.abs(e.clientY - drag.startClient.y) > 3) drag.moved = true;
    if (!drag.moved) return;
    const raw = clientToMinute(e.clientX, e.clientY);
    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b }));
      const index = next.findIndex((b) => b.id === drag.blockId);
      if (index === -1) return prev;
      const current = next[index][drag.edge];
      const unwrapped = unwrapNear(raw, current);
      const hit = setEdge(next, index, drag.edge, unwrapped);
      if (hit) setPulse({ id: drag.blockId, mode: "scale" });
      return next;
    });
  }

  function onHandlePointerUp() {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "edge") return;
    dragRef.current = null;
    if (!drag.moved) {
      draggingRef.current = false;
      selectBlock(drag.blockId);
      return;
    }
    const block = blocksRef.current.find((b) => b.id === drag.blockId);
    if (!block) {
      draggingRef.current = false;
      return;
    }
    const index = blocksRef.current.findIndex((b) => b.id === drag.blockId);
    const lim = neighborLimits(blocksRef.current, index);
    let target = snapMinutes(block[drag.edge]);
    if (drag.edge === "end") target = Math.min(Math.max(target, block.start + 15), lim.nextStartAbs);
    else target = Math.min(Math.max(target, lim.prevEndAbs), block.end - 15);
    const targetBlock = drag.edge === "end" ? { start: block.start, end: target } : { start: target, end: block.end };
    runSpring(drag.blockId, targetBlock, () => {
      draggingRef.current = false;
      persistBlock(drag.blockId);
    });
  }

  // ---- whole-block move drag ----
  function onBlockPointerDown(e: React.PointerEvent, blockId: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const block = blocksRef.current.find((b) => b.id === blockId);
    if (!block) return;
    draggingRef.current = true;
    const raw = clientToMinute(e.clientX, e.clientY);
    const initRawUnwrapped = unwrapNear(raw, (block.start + block.end) / 2);
    dragRef.current = {
      kind: "move",
      blockId,
      startClient: { x: e.clientX, y: e.clientY },
      moved: false,
      initStart: block.start,
      initEnd: block.end,
      initRawUnwrapped,
    };
  }

  function onBlockPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "move") return;
    if (Math.abs(e.clientX - drag.startClient.x) + Math.abs(e.clientY - drag.startClient.y) > 3) drag.moved = true;
    if (!drag.moved) return;
    const raw = clientToMinute(e.clientX, e.clientY);
    const unwrapped = unwrapNear(raw, drag.initRawUnwrapped);
    const delta = unwrapped - drag.initRawUnwrapped;
    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b }));
      const index = next.findIndex((b) => b.id === drag.blockId);
      if (index === -1) return prev;
      next[index].start = drag.initStart;
      next[index].end = drag.initEnd;
      const hit = moveBlock(next, index, delta);
      if (hit) setPulse({ id: drag.blockId, mode: "flash" });
      return next;
    });
  }

  function onBlockPointerUp() {
    const drag = dragRef.current;
    if (!drag || drag.kind !== "move") return;
    dragRef.current = null;
    if (!drag.moved) {
      draggingRef.current = false;
      selectBlock(drag.blockId);
      return;
    }
    const index = blocksRef.current.findIndex((b) => b.id === drag.blockId);
    const block = blocksRef.current[index];
    const duration = block.end - block.start;
    const lim = neighborLimits(blocksRef.current, index);
    const minStart = lim.prevEndAbs, maxStart = lim.nextStartAbs - duration;
    const targetStart = Math.min(Math.max(snapMinutes(block.start), minStart), maxStart);
    runSpring(drag.blockId, { start: targetStart, end: targetStart + duration }, () => {
      draggingRef.current = false;
      persistBlock(drag.blockId);
    });
  }

  // ---- keyboard nudge (edge handles) ----
  function onHandleKeyDown(e: React.KeyboardEvent, blockId: string, edge: "start" | "end") {
    let delta = 0;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = e.shiftKey ? -30 : -5;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = e.shiftKey ? 30 : 5;
    else return;
    e.preventDefault();
    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b }));
      const index = next.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;
      setEdge(next, index, edge, next[index][edge] + delta);
      return next;
    });
    persistBlock(blockId);
  }

  // ---- exact time entry (legend) ----
  function onTimeInputChange(blockId: string, edge: "start" | "end", value: string) {
    if (!value) return;
    setBlocks((prev) => {
      const next = prev.map((b) => ({ ...b }));
      const index = next.findIndex((b) => b.id === blockId);
      if (index === -1) return prev;
      const raw = minutesFromTimeString(value);
      const unwrapped = unwrapNear(raw, next[index][edge]);
      setEdge(next, index, edge, unwrapped);
      return next;
    });
    persistBlock(blockId);
  }

  function onRemoveBlock(block: RingBlock) {
    if (block.kind !== "item" || !block.item) return;
    if (selectedId === block.id) setSelectedId(null);
    softDeleteItem.mutate(block.item.id);
  }

  // ---- open track: click to add ----
  function onTrackClick(e: React.MouseEvent<SVGCircleElement>) {
    const raw = clientToMinute(e.clientX, e.clientY);
    const current = blocksRef.current;
    for (let i = 0; i < current.length; i++) {
      const lim = neighborLimits(current, i);
      const candidate = unwrapNear(raw, (current[i].end + lim.nextStartAbs) / 2);
      if (candidate >= current[i].end && candidate <= lim.nextStartAbs) {
        const gapStart = current[i].end, gapEnd = lim.nextStartAbs;
        if (gapEnd - gapStart < 10) return;
        const duration = Math.min(ADD_BLOCK_DURATION_MINUTES, gapEnd - gapStart);
        const start = Math.min(Math.max(candidate - duration / 2, gapStart), gapEnd - duration);
        setAddPopover({ x: e.clientX, y: e.clientY, gapIndex: i, start, duration });
        return;
      }
    }
  }

  async function onPickAddCategory(choice: { category: Category; label: string }) {
    if (!addPopover) return;
    setAddPopover(null);
    await createItem.mutateAsync({
      title: choice.label,
      category: choice.category,
      due_date: toDateKey(new Date()),
      due_time: minutesToTimeString(addPopover.start),
      estimated_duration: addPopover.duration,
    });
  }

  const selected = selectedId ? blocks.find((b) => b.id === selectedId) : null;
  const open = openMinutes(blocks);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link to="/calendar">Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="mx-auto flex flex-col items-center gap-4">
          <div className="relative" style={{ width: 208, height: 208, "--day-ring-sleep": "#6366f1" } as React.CSSProperties}>
            <svg ref={svgRef} viewBox="0 0 420 420" className="h-full w-full overflow-visible">
              <circle
                cx={RING_CENTER}
                cy={RING_CENTER}
                r={RING_RADIUS}
                fill="none"
                stroke="var(--muted)"
                strokeWidth={34}
                className="cursor-pointer"
                onClick={onTrackClick}
              />
              <g className="opacity-40">
                {HOUR_TICKS.map((t) => (
                  <line
                    key={t.hour}
                    x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                    stroke="var(--muted-foreground)"
                    strokeWidth={t.major ? 1.4 : 1}
                    opacity={t.major ? 1 : 0.6}
                  />
                ))}
              </g>
              {HOUR_TICKS.filter((t) => t.label).map((t) => (
                <text
                  key={t.hour}
                  x={t.labelX} y={t.labelY}
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--muted-foreground)"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {t.label}
                </text>
              ))}
              {blocks.map((block) => {
                const insetMin = Math.min(1.4, ((block.end - block.start) / 1440) * 360 * 0.18) / 360 * 1440;
                const color = blockColor(block);
                return (
                  <path
                    key={block.id}
                    d={arcPath(block.start + insetMin, block.end - insetMin, RING_RADIUS)}
                    fill="none"
                    stroke={color}
                    strokeWidth={30}
                    strokeLinecap="round"
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      block.id === selectedId && "brightness-110",
                      pulse?.id === block.id && pulse.mode === "flash" && "[animation:day-ring-pulse-flash_220ms_ease]",
                    )}
                    style={{ touchAction: "none" }}
                    onPointerDown={(e) => onBlockPointerDown(e, block.id)}
                    onPointerMove={onBlockPointerMove}
                    onPointerUp={onBlockPointerUp}
                    onPointerCancel={onBlockPointerUp}
                  >
                    <title>{block.label}</title>
                  </path>
                );
              })}
              {blocks.map((block) => {
                const color = blockColor(block);
                const p1 = pointOnRing(block.start, RING_RADIUS);
                const p2 = pointOnRing(block.end, RING_RADIUS);
                return (
                  <g key={block.id}>
                    <circle
                      cx={p1.x} cy={p1.y} r={9}
                      fill="var(--card)" stroke={color} strokeWidth={3}
                      tabIndex={0}
                      role="slider"
                      aria-label={`${block.label} start`}
                      aria-valuetext={fmtTime(block.start)}
                      className={cn(
                        "cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                        pulse?.id === block.id && pulse.mode === "scale" && "[animation:day-ring-pulse-scale_220ms_ease]",
                      )}
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => onHandlePointerDown(e, block.id, "start")}
                      onPointerMove={onHandlePointerMove}
                      onPointerUp={onHandlePointerUp}
                      onPointerCancel={onHandlePointerUp}
                      onKeyDown={(e) => onHandleKeyDown(e, block.id, "start")}
                    />
                    <circle
                      cx={p2.x} cy={p2.y} r={9}
                      fill="var(--card)" stroke={color} strokeWidth={3}
                      tabIndex={0}
                      role="slider"
                      aria-label={`${block.label} end`}
                      aria-valuetext={fmtTime(block.end)}
                      className={cn(
                        "cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                        pulse?.id === block.id && pulse.mode === "scale" && "[animation:day-ring-pulse-scale_220ms_ease]",
                      )}
                      style={{ touchAction: "none" }}
                      onPointerDown={(e) => onHandlePointerDown(e, block.id, "end")}
                      onPointerMove={onHandlePointerMove}
                      onPointerUp={onHandlePointerUp}
                      onPointerCancel={onHandlePointerUp}
                      onKeyDown={(e) => onHandleKeyDown(e, block.id, "end")}
                    />
                  </g>
                );
              })}
              {(() => {
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const p1 = pointOnRing(nowMin, 124);
                const p2 = pointOnRing(nowMin, 192);
                const pd = pointOnRing(nowMin, 196);
                return (
                  <>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--destructive)" strokeWidth={2} />
                    <circle cx={pd.x} cy={pd.y} r={4.5} fill="var(--destructive)" />
                  </>
                );
              })()}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[18%] text-center">
              {selected ? (
                <>
                  <div className="mb-0.5 flex items-center gap-1.5 text-[13px] font-semibold">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: blockColor(selected) }} />
                    {selected.label}
                  </div>
                  <div className="text-lg font-bold tabular-nums leading-none">{fmtDur(selected.end - selected.start)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {fmtTime(selected.start)} – {fmtTime(selected.end)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold tabular-nums leading-none">
                    {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">Today &middot; {fmtDur(open)} open</div>
                </>
              )}
            </div>
          </div>

          <ul className="w-full">
            {blocks.map((block) => {
              const isOpen = block.id === selectedId;
              const color = blockColor(block);
              return (
                <li key={block.id} className="border-b border-border last:border-b-0">
                  <div
                    className="flex cursor-pointer items-center gap-2 py-1.5"
                    onClick={() => selectBlock(block.id)}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                    <span className="flex-1 truncate text-sm font-medium">{block.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtTime(block.start)} – {fmtTime(block.end)}
                    </span>
                    <span className="min-w-[3.4em] text-right text-xs font-semibold tabular-nums">
                      {fmtDur(block.end - block.start)}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="flex flex-wrap items-center gap-2 py-1.5 pl-[1.15rem]">
                      <input
                        type="time"
                        value={minutesToTimeString(block.start)}
                        onChange={(e) => onTimeInputChange(block.id, "start", e.target.value)}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">&ndash;</span>
                      <input
                        type="time"
                        value={minutesToTimeString(block.end)}
                        onChange={(e) => onTimeInputChange(block.id, "end", e.target.value)}
                        className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
                      />
                      {block.kind === "item" && (
                        <button
                          type="button"
                          className="ml-auto text-xs text-destructive hover:underline"
                          onClick={() => onRemoveBlock(block)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            <li className="flex items-center gap-2 py-1.5 text-muted-foreground">
              <span className="size-2.5 shrink-0 rounded-full border border-dashed border-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Open</span>
              <span className="text-xs font-semibold tabular-nums">{fmtDur(open)}</span>
            </li>
          </ul>
        </div>

        {addPopover && (
          <div
            ref={popoverRef}
            className="fixed z-50 flex gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-lg"
            style={{ left: Math.max(8, addPopover.x - 70), top: addPopover.y + 12 }}
          >
            {ADD_CATEGORY_CHOICES.map((choice) => (
              <button
                key={choice.category}
                type="button"
                title={choice.label}
                aria-label={`Add ${choice.label} block`}
                className="size-7 rounded-full border-2 border-transparent transition-colors hover:border-foreground"
                style={{ background: CATEGORY_HEX[choice.category] }}
                onClick={() => onPickAddCategory(choice)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
