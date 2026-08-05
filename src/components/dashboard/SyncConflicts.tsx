import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGoogleConnected, useResolveConflict, useSyncConflicts } from "@/hooks/useGoogle";

export function SyncConflicts() {
  const { data: connected } = useGoogleConnected();
  const { data: conflicts } = useSyncConflicts();
  const resolveConflict = useResolveConflict();

  if (!connected || !conflicts || conflicts.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Conflicts ({conflicts.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conflicts.map((conflict) => (
          <div key={conflict.id} className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Both your copy and Google {conflict.source === "calendar" ? "Calendar" : "Tasks"} changed
                since the last sync.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-auto shrink-0 px-2 py-0.5 text-xs text-muted-foreground"
                disabled={resolveConflict.isPending}
                onClick={() => resolveConflict.mutate({ id: conflict.id, resolution: "dismiss" })}
                title="Ignore this conflict without changing either side — it'll reappear if something changes again"
              >
                Dismiss
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Mine</p>
                <p>{conflict.local_snapshot.title}</p>
                <p className="text-xs text-muted-foreground">
                  {conflict.local_snapshot.due_date ?? "—"} · {conflict.local_snapshot.status}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  disabled={resolveConflict.isPending}
                  onClick={() => resolveConflict.mutate({ id: conflict.id, resolution: "mine" })}
                >
                  Keep mine
                </Button>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Google's</p>
                <p>{conflict.remote_snapshot.title}</p>
                <p className="text-xs text-muted-foreground">
                  {conflict.remote_snapshot.due_date ?? "—"} · {conflict.remote_snapshot.status}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  disabled={resolveConflict.isPending}
                  onClick={() => resolveConflict.mutate({ id: conflict.id, resolution: "google" })}
                >
                  Keep Google's
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
