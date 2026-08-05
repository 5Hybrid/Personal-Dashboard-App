import { useEffect } from "react";
import { WidgetContainer } from "@/components/externalApps/WidgetContainer";
import { EXTERNAL_APPS } from "@/lib/externalApps/config";
import { installExternalAppMessageBridge } from "@/lib/externalApps/eventBus";
import { getAppUiState, useExternalAppStore } from "@/store/externalAppStore";

// The only place that knows the registry exists — Dashboard.tsx just renders
// <ExternalAppsSection />. Adding an app means adding one object to
// EXTERNAL_APPS (src/lib/externalApps/config.ts); nothing here changes.
export function ExternalAppsSection() {
  useEffect(() => {
    installExternalAppMessageBridge();
  }, []);

  const appsState = useExternalAppStore((s) => s.apps);
  const setHidden = useExternalAppStore((s) => s.setHidden);

  const activeApps = EXTERNAL_APPS.filter((app) => app.status === "active");
  const hiddenApps = activeApps.filter((app) => getAppUiState(appsState, app.id).hidden);
  const visibleApps = activeApps.filter((app) => !getAppUiState(appsState, app.id).hidden);

  if (activeApps.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleApps.map((app) => (
          <WidgetContainer key={app.id} app={app} />
        ))}
      </div>
      {hiddenApps.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {hiddenApps.length} app{hiddenApps.length > 1 ? "s" : ""} hidden ·{" "}
          {hiddenApps.map((app) => (
            <button
              key={app.id}
              type="button"
              className="underline"
              onClick={() => setHidden(app.id, false)}
            >
              Show {app.name}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
