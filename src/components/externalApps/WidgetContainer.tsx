import { AlertCircle, ExternalLink, Globe, Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useExternalApp } from "@/hooks/useExternalApp";
import type { ExternalAppConfig } from "@/lib/externalApps/config";
import { cn } from "@/lib/utils";
import { getAppUiState, useExternalAppStore } from "@/store/externalAppStore";

const SIZE_CLASS: Record<ExternalAppConfig["preferredSize"], string> = {
  small: "h-64",
  medium: "h-96",
  large: "h-[32rem]",
};
const EXPANDED_CLASS = "h-[42rem]";

const STATUS_DOT: Record<"loading" | "ready" | "error", string> = {
  loading: "bg-amber-500",
  ready: "bg-emerald-500",
  error: "bg-rose-500",
};

// The reusable shell every external app loads into — reuses the existing
// Card/CardHeader/CardTitle/CardAction/CardContent components so a widget
// automatically matches dashboard spacing, rounding, and dark mode with zero
// app-specific styling. This is the only place iframe/pop-out/error-card
// logic lives; ExternalAppsSection just maps the registry onto this.
export function WidgetContainer({ app }: { app: ExternalAppConfig }) {
  const Icon = app.icon;
  const uiState = useExternalAppStore((s) => getAppUiState(s.apps, app.id));
  const setExpanded = useExternalAppStore((s) => s.setExpanded);
  const setHidden = useExternalAppStore((s) => s.setHidden);

  const { containerRef, active, status, attempt, handleLoad, reload, popOut, openInBrowser } = useExternalApp(
    app,
    false,
  );

  if (uiState.hidden) return null;

  const heightClass = uiState.expanded ? EXPANDED_CLASS : SIZE_CLASS[app.preferredSize];

  return (
    <div ref={containerRef}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-4 text-primary" />
            {app.name}
            <span className={cn("size-2 rounded-full", STATUS_DOT[status])} title={`Status: ${status}`} />
          </CardTitle>
          <CardAction className="flex gap-1">
            <Button size="icon-sm" variant="outline" onClick={reload} aria-label="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              onClick={() => setExpanded(app.id, !uiState.expanded)}
              aria-label={uiState.expanded ? "Collapse" : "Expand"}
            >
              {uiState.expanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            </Button>
            <Button size="icon-sm" variant="outline" onClick={popOut} aria-label="Pop out">
              <ExternalLink className="size-3.5" />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={openInBrowser} aria-label="Open in browser">
              <Globe className="size-3.5" />
            </Button>
            <Button size="icon-sm" variant="outline" onClick={() => setHidden(app.id, true)} aria-label="Remove">
              <X className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className={cn("overflow-hidden rounded-md p-0", heightClass)}>
          {!active ? (
            // Scrolled out of view — the iframe is unmounted entirely below,
            // not just visually hidden, so it makes zero network requests
            // until it's back in view.
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              {app.name}
            </div>
          ) : status === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <AlertCircle className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{app.name} is currently unavailable.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={reload}>
                  Retry
                </Button>
                <Button size="sm" onClick={openInBrowser}>
                  Open Full App
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative h-full">
              {status === "loading" && <div className="absolute inset-0 animate-pulse bg-muted/50" />}
              <iframe
                key={attempt}
                src={app.url}
                title={app.name}
                onLoad={handleLoad}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                className={cn(
                  "h-full w-full border-0 transition-opacity duration-300",
                  status === "ready" ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
