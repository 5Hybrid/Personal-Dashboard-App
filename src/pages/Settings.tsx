import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useAutostartEnabled, useSetAutostart } from "@/hooks/useAutostart";
import { useContexts, useUpdateContext } from "@/hooks/useContexts";
import {
  useCalendarList,
  useConnectGoogle,
  useDisconnectGoogle,
  useGoogleConnected,
  useSyncNow,
} from "@/hooks/useGoogle";
import { useTestObsidianVault } from "@/hooks/useObsidianVault";
import { useBackupNow, usePreferences, useSetPreference, useSyncFromBackup } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { parseSelectedCalendarIds, SELECTED_CALENDARS_PREF_KEY } from "@/lib/googleCalendarSelection";
import { NOTIFICATION_DEFAULTS, WEEKDAY_LABELS } from "@/lib/notificationDefaults";
import type { Theme } from "@/store/themeStore";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
  { value: "futuristic", label: "Futuristic" },
];

function ProfileSection() {
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();
  const [localName, setLocalName] = useState<string | null>(null);
  const [localLocation, setLocalLocation] = useState<string | null>(null);

  const name = localName ?? pref(prefs, "user_name");
  const location = localLocation ?? pref(prefs, "weather_location");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Name</Label>
          <p className="mb-1 text-xs text-muted-foreground">Used for the Dashboard's greeting.</p>
          <Input
            className="w-56"
            value={name}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => {
              setPreference.mutate({ key: "user_name", value: name });
              setLocalName(null);
            }}
          />
        </div>
        <div>
          <Label>Weather location</Label>
          <p className="mb-1 text-xs text-muted-foreground">
            City (and province/state, to disambiguate) for the Dashboard's weather card — looked up
            via Open-Meteo, no account or API key needed.
          </p>
          <Input
            className="w-56"
            value={location}
            onChange={(e) => setLocalLocation(e.target.value)}
            onBlur={() => {
              setPreference.mutate({ key: "weather_location", value: location });
              setLocalLocation(null);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function GoogleAccountSection() {
  const { data: connected, isLoading } = useGoogleConnected();
  const connectGoogle = useConnectGoogle();
  const disconnectGoogle = useDisconnectGoogle();
  const syncNow = useSyncNow();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : connected ? (
          <>
            <p className="text-sm text-muted-foreground">Connected to Google Calendar and Tasks.</p>
            <div className="flex gap-2">
              <Button onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
                {syncNow.isPending ? "Syncing…" : "Sync Now"}
              </Button>
              <Button
                variant="outline"
                onClick={() => disconnectGoogle.mutate()}
                disabled={disconnectGoogle.isPending}
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Not connected. Clicking below opens your browser to sign in — this app never
              sees your Google password, only a Calendar/Tasks-scoped access token.
            </p>
            <Button onClick={() => connectGoogle.mutate()} disabled={connectGoogle.isPending}>
              {connectGoogle.isPending ? "Waiting for sign-in…" : "Connect Google Account"}
            </Button>
          </>
        )}
        {connectGoogle.isError && (
          <p className="text-sm text-destructive">{String(connectGoogle.error)}</p>
        )}
        {syncNow.isError && (
          // A failed sync clears the stored tokens itself when the cause is a
          // dead refresh token (see oauth::RECONNECT_REQUIRED), which flips
          // `connected` to false moments after this renders — keeping the
          // message outside the connected/disconnected branches means it
          // survives that transition instead of disappearing mid-explanation.
          <p className="text-sm text-destructive">
            {String(syncNow.error).includes("GOOGLE_RECONNECT_REQUIRED")
              ? "Your Google connection expired. Reconnect above to resume sync."
              : String(syncNow.error)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleCalendarsSection() {
  const { data: connected } = useGoogleConnected();
  const { data: calendars, isLoading, isError, error, refetch } = useCalendarList(!!connected);
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();

  const selectedIds = useMemo(
    () => parseSelectedCalendarIds(prefs?.[SELECTED_CALENDARS_PREF_KEY]),
    [prefs],
  );

  if (!connected) return null;

  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setPreference.mutate({ key: SELECTED_CALENDARS_PREF_KEY, value: JSON.stringify(next) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendars</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Choose which of your Google calendars — including ones shared with you — show up on
          the Calendar page's grid, alongside your primary calendar.
        </p>
        <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
          {!calendars || calendars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calendars found.</p>
          ) : (
            <ul className="space-y-1.5">
              {calendars.map((cal) => {
                const isPrimary = !!cal.primary;
                const checked = isPrimary || selectedIds.includes(cal.id);
                return (
                  <li key={cal.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={checked}
                      disabled={isPrimary}
                      onChange={() => toggle(cal.id)}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cal.background_color ?? "var(--muted-foreground)" }}
                    />
                    <span>{cal.summary ?? cal.id}</span>
                    {isPrimary && <span className="text-xs text-muted-foreground">(primary, always shown)</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function ContextManagementSection() {
  const { data: contexts, isLoading, isError, error, refetch } = useContexts();
  const updateContext = useUpdateContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories & Contexts</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {!contexts || contexts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Contexts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b px-2 py-1">Type</th>
                <th className="border-b px-2 py-1">Name</th>
                <th className="border-b px-2 py-1">Status</th>
                <th className="border-b px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {contexts.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-2 py-1">{c.type}</td>
                  <td className="px-2 py-1">{c.name}</td>
                  <td className="px-2 py-1">{c.status}</td>
                  <td className="px-2 py-1 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateContext.isPending}
                      onClick={() =>
                        updateContext.mutate({
                          ...c,
                          status: c.status === "Active" ? "Archived" : "Active",
                        })
                      }
                    >
                      {c.status === "Active" ? "Archive" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </QueryBoundary>
      </CardContent>
    </Card>
  );
}

function pref(prefs: Record<string, string> | undefined, key: keyof typeof NOTIFICATION_DEFAULTS): string {
  return prefs?.[key] ?? NOTIFICATION_DEFAULTS[key];
}

function NotificationPreferencesSection() {
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();

  const boolPref = (key: keyof typeof NOTIFICATION_DEFAULTS) => pref(prefs, key) === "true";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Morning Briefing</Label>
            <p className="text-xs text-muted-foreground">Daily summary of what's due today.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              className="w-28"
              value={pref(prefs, "morning_briefing_time")}
              onChange={(e) => setPreference.mutate({ key: "morning_briefing_time", value: e.target.value })}
            />
            <Switch
              checked={boolPref("morning_briefing_enabled")}
              onCheckedChange={(checked) =>
                setPreference.mutate({ key: "morning_briefing_enabled", value: String(checked) })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Evening Review</Label>
            <p className="text-xs text-muted-foreground">Daily prompt to review and plan ahead.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              className="w-28"
              value={pref(prefs, "evening_review_time")}
              onChange={(e) => setPreference.mutate({ key: "evening_review_time", value: e.target.value })}
            />
            <Switch
              checked={boolPref("evening_review_enabled")}
              onCheckedChange={(checked) =>
                setPreference.mutate({ key: "evening_review_enabled", value: String(checked) })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Weekly Planning</Label>
            <p className="text-xs text-muted-foreground">Weekly reminder to plan the week ahead.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={pref(prefs, "weekly_planning_day")}
              onValueChange={(v) => setPreference.mutate({ key: "weekly_planning_day", value: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_LABELS.map((label, i) => (
                  <SelectItem key={label} value={String(i)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              className="w-28"
              value={pref(prefs, "weekly_planning_time")}
              onChange={(e) => setPreference.mutate({ key: "weekly_planning_time", value: e.target.value })}
            />
            <Switch
              checked={boolPref("weekly_planning_enabled")}
              onCheckedChange={(checked) =>
                setPreference.mutate({ key: "weekly_planning_enabled", value: String(checked) })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Upcoming Deadline</Label>
            <p className="text-xs text-muted-foreground">Lead time before a due date to warn ahead of it.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              className="w-20"
              value={pref(prefs, "upcoming_deadline_lead_hours")}
              onChange={(e) =>
                setPreference.mutate({ key: "upcoming_deadline_lead_hours", value: e.target.value })
              }
            />
            <span className="text-sm text-muted-foreground">hours before</span>
            <Switch
              checked={boolPref("upcoming_deadline_enabled")}
              onCheckedChange={(checked) =>
                setPreference.mutate({ key: "upcoming_deadline_enabled", value: String(checked) })
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Overdue</Label>
            <p className="text-xs text-muted-foreground">Fires once when a due date passes uncompleted.</p>
          </div>
          <Switch
            checked={boolPref("overdue_enabled")}
            onCheckedChange={(checked) => setPreference.mutate({ key: "overdue_enabled", value: String(checked) })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SyncIntervalSection() {
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();
  const [localValue, setLocalValue] = useState<string | null>(null);

  const value = localValue ?? pref(prefs, "sync_interval_minutes");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync Interval</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            className="w-20"
            value={value}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
              setPreference.mutate({ key: "sync_interval_minutes", value });
              setLocalValue(null);
            }}
          />
          <span className="text-sm text-muted-foreground">minutes between Google syncs</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Takes effect once Google Calendar/Tasks sync (build Phase 7) is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function BackupSection() {
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();
  const backupNow = useBackupNow();
  const syncFromBackup = useSyncFromBackup();
  const [localValue, setLocalValue] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const folderPath = localValue ?? pref(prefs, "backup_folder_path");
  const lastBackupAt = prefs?.["last_backup_at"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          There's no cloud backend by design, so life-os.sqlite3 is the only copy of everything.
          Point this at a folder synced by Drive, Dropbox, OneDrive, etc. and a snapshot gets
          written there roughly 5 minutes after you stop editing (and at least once a day
          either way). Point another device's Life OS at the same folder and it'll offer to load
          the newer snapshot next time it checks — that's also how to move everything to a new
          device.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={folderPath}
            placeholder="e.g. C:\\Users\\you\\Google Drive\\LifeOS Backups"
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
              setPreference.mutate({ key: "backup_folder_path", value: folderPath });
              setLocalValue(null);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => backupNow.mutate()} disabled={backupNow.isPending || !folderPath.trim()}>
            {backupNow.isPending ? "Backing up…" : "Backup Now"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSyncMessage(null);
              syncFromBackup.mutate(undefined, {
                onSuccess: (result) => {
                  if (!result.synced) {
                    setSyncMessage("Already up to date — no newer backup found in that folder.");
                  }
                },
              });
            }}
            disabled={syncFromBackup.isPending || !folderPath.trim()}
          >
            {syncFromBackup.isPending ? "Checking…" : "Sync"}
          </Button>
          <span className="text-xs text-muted-foreground">
            {lastBackupAt ? `Last backup: ${new Date(lastBackupAt).toLocaleString()}` : "No backup yet"}
          </span>
        </div>
        {backupNow.isError && (
          <p className="text-sm text-destructive">{String(backupNow.error)}</p>
        )}
        {syncFromBackup.isError && (
          <p className="text-sm text-destructive">{String(syncFromBackup.error)}</p>
        )}
        {syncMessage && <p className="text-sm text-muted-foreground">{syncMessage}</p>}
      </CardContent>
    </Card>
  );
}

function ObsidianVaultSection() {
  const { data: prefs } = usePreferences();
  const setPreference = useSetPreference();
  const testVault = useTestObsidianVault();
  const [localValue, setLocalValue] = useState<string | null>(null);

  const vaultPath = localValue ?? pref(prefs, "obsidian_vault_path");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Obsidian Vault</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Point this at your Obsidian vault's folder to search and preview its notes from the
          Search palette (Ctrl/Cmd+K), alongside your Life OS items and notes.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={vaultPath}
            placeholder="e.g. C:\\Users\\you\\Documents\\MyVault"
            onChange={(e) => {
              setLocalValue(e.target.value);
              testVault.reset();
            }}
            onBlur={() => {
              setPreference.mutate({ key: "obsidian_vault_path", value: vaultPath });
              setLocalValue(null);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => testVault.mutate(vaultPath)}
            disabled={testVault.isPending || !vaultPath.trim()}
          >
            {testVault.isPending ? "Checking…" : "Test Connection"}
          </Button>
          {testVault.data && (
            <span className={testVault.data.valid ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {testVault.data.valid
                ? `Found ${testVault.data.note_count} note${testVault.data.note_count === 1 ? "" : "s"}.`
                : testVault.data.error}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={theme === option.value ? "default" : "outline"}
              onClick={() => setTheme(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          "System" follows your OS's light/dark setting and updates automatically if it changes.
        </p>
      </CardContent>
    </Card>
  );
}

function AutostartSection() {
  const { data: enabled, isLoading } = useAutostartEnabled();
  const setAutostart = useSetAutostart();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start with Windows</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Launch Life OS minimized to the tray at login, so Morning Briefing and other
            scheduled notifications still fire on days you don't open the app yourself.
          </p>
          <Switch
            checked={!!enabled}
            disabled={isLoading || setAutostart.isPending}
            onCheckedChange={(checked) => setAutostart.mutate(checked)}
          />
        </div>
        {setAutostart.isError && (
          <p className="mt-2 text-sm text-destructive">{String(setAutostart.error)}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ProfileSection />
      <GoogleAccountSection />
      <GoogleCalendarsSection />
      <ContextManagementSection />
      <NotificationPreferencesSection />
      <SyncIntervalSection />
      <BackupSection />
      <ObsidianVaultSection />
      <AutostartSection />
      <ThemeSection />
    </div>
  );
}
