import { useState } from "react";
import { CloudDownload } from "lucide-react";
import {
  useDismissRemoteBackup,
  useRemoteBackupStatus,
  useRestoreFromBackup,
} from "@/hooks/usePreferences";
import { Button } from "@/components/ui/button";

/**
 * Surfaces whenever another device has pushed a newer snapshot into the
 * shared backup folder (see backup.rs's check_remote_backup, polled every
 * few minutes by useRemoteBackupStatus). Loading it restarts the app onto
 * that snapshot; "Keep local" just marks it seen so it stops resurfacing.
 */
export function RemoteBackupPrompt() {
  const { data: status } = useRemoteBackupStatus();
  const dismiss = useDismissRemoteBackup();
  const restore = useRestoreFromBackup();
  const [restoring, setRestoring] = useState(false);

  if (!status) return null;

  const writtenAt = status.written_at;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-md border border-[color:var(--glass-border)] bg-sidebar/90 p-5 shadow-[0_24px_64px_-16px_var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-start gap-3">
          <CloudDownload className="mt-0.5 size-5 shrink-0 text-sidebar-foreground/70" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-sidebar-foreground">Newer data found</p>
            <p className="mt-1 text-sm text-sidebar-foreground/70">
              Another device backed up to your shared folder on{" "}
              {new Date(writtenAt).toLocaleString()}. Load it here? This replaces everything in
              this device's local data with that snapshot.
            </p>
            {restore.isError && (
              <p className="mt-2 text-sm text-destructive">{String(restore.error)}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            disabled={restoring}
            onClick={() => dismiss.mutate(writtenAt)}
          >
            Keep local
          </Button>
          <Button
            disabled={restoring}
            onClick={() => {
              setRestoring(true);
              restore.mutate(writtenAt, { onError: () => setRestoring(false) });
            }}
          >
            {restoring ? "Restoring…" : "Load it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
