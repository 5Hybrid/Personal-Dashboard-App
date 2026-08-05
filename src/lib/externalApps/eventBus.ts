import { EXTERNAL_APPS } from "@/lib/externalApps/config";

// Generic pub/sub — the "communication layer" between embedded apps and the
// dashboard. Deliberately just a Map<string, Set<fn>>: no new dependency,
// same "small, self-contained lib module" size as calendarGrid.ts etc.
type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function on(event: string, handler: Handler): void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
}

export function off(event: string, handler: Handler): void {
  listeners.get(event)?.delete(handler);
}

export function emit(event: string, payload?: unknown): void {
  listeners.get(event)?.forEach((handler) => handler(payload));
}

/** `external-app:<appId>:<eventName>` — what a subscriber listens for. */
export function externalAppEventName(appId: string, eventName: string): string {
  return `external-app:${appId}:${eventName}`;
}

interface ExternalAppMessage {
  type: "external-app-event";
  event: string;
  payload?: unknown;
}

function isExternalAppMessage(data: unknown): data is ExternalAppMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "external-app-event" &&
    typeof (data as Record<string, unknown>).event === "string"
  );
}

let bridgeInstalled = false;

/**
 * Wires up the single `window.addEventListener("message", ...)` that
 * receives events from embedded iframes and re-emits them on the bus as
 * `external-app:<id>:<event>`. Call once (ExternalAppsSection does this on
 * mount) — safe to call multiple times, only installs once.
 *
 * Contract an embedded app must follow to publish an event (documented here
 * since there's no other app-facing spec for it yet):
 *   window.parent.postMessage({ type: "external-app-event", event: "habits-completed", payload: {...} }, "*")
 *
 * Origin is validated against the *registered* URL for the app that message
 * appears to have come from (by matching event.origin against each
 * EXTERNAL_APPS entry's URL origin) — an iframe for a different app, or an
 * unrelated page, can't spoof another app's events.
 *
 * Note: as of this writing, Habit Tracker does not send these messages —
 * this installs a working receiver with no live producer yet. It starts
 * doing something the moment Habit Tracker (or a future app) adopts the
 * contract above; no framework change needed on this side.
 */
export function installExternalAppMessageBridge(): void {
  if (bridgeInstalled) return;
  bridgeInstalled = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (!isExternalAppMessage(event.data)) return;
    const app = EXTERNAL_APPS.find((a) => {
      try {
        return new URL(a.url).origin === event.origin;
      } catch {
        return false;
      }
    });
    if (!app) return; // message didn't come from a registered app's origin
    emit(externalAppEventName(app.id, event.data.event), event.data.payload);
  });
}
