import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/lib/commands";
import type { ExternalAppConfig } from "@/lib/externalApps/config";

export type ExternalAppStatus = "loading" | "ready" | "error";

// A blocked/cross-origin-restricted iframe doesn't raise a catchable JS
// error — it just never fires `onload`. Racing onload against this timeout
// is the honest, implementable version of "detect embedding is blocked":
// a heuristic, not a perfect detector (a genuinely slow page can also trip
// it), which is why Retry/Pop Out/Open in Browser are always one click away
// rather than the app silently giving up.
const LOAD_TIMEOUT_MS = 6000;

export function useExternalApp(app: ExternalAppConfig, collapsed: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [status, setStatus] = useState<ExternalAppStatus>("loading");
  const [attempt, setAttempt] = useState(0); // bumping remounts the iframe — used by both reload() and retry
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Suspend rendering when hidden" — scrolled out of view stops the iframe
  // entirely (unmounted by the caller when !active) rather than just
  // visually hiding it, so a collapsed/off-screen widget makes zero network
  // requests until it's back in view.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), {
      threshold: 0.1,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const active = isVisible && !collapsed;

  useEffect(() => {
    if (!active) return;
    setStatus("loading");
    timeoutRef.current = setTimeout(() => setStatus("error"), LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, attempt, app.url]);

  const handleLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus("ready");
  };

  const reload = () => setAttempt((a) => a + 1);

  const popOut = () => {
    commands.openAppWindow(app.id, app.url, app.name).catch(() => {});
  };

  const openInBrowser = () => {
    openUrl(app.url).catch(() => {});
  };

  return { containerRef, active, status, attempt, handleLoad, reload, popOut, openInBrowser };
}
