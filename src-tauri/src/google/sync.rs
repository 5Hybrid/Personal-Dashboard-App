use super::api::{self, CalendarEvent, Task};
use super::oauth;
use crate::commands::{now, row_to_item, ITEM_COLUMNS};
use crate::models::Item;
use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::json;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use uuid::Uuid;

const SYNC_INTERVAL_FLOOR: Duration = Duration::from_secs(30);

/// Lets any Tauri command (e.g. a delete) wake the background sync loop
/// immediately instead of waiting out the rest of its sleep interval.
/// `mpsc::Sender` isn't `Sync`, so it's wrapped in a `Mutex` to satisfy
/// Tauri's managed-state bound; sending is still effectively a fire-and-forget
/// signal, not a lock held across any real work.
pub struct SyncTrigger(Mutex<mpsc::Sender<()>>);

impl SyncTrigger {
    /// Best-effort: if the sync thread has somehow gone away, there's no
    /// meaningful error to surface to the caller (a delete succeeded either
    /// way — this only affects how soon it reaches Google).
    pub fn notify(&self) {
        if let Ok(tx) = self.0.lock() {
            let _ = tx.send(());
        }
    }
}

// ---------------------------------------------------------------------------
// Pure conflict-detection logic (see spec §7.2) — kept free of any I/O so it
// can be unit-tested directly. This is the highest-risk piece of Phase 7.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PullDecision {
    /// Neither side changed since the last sync — nothing to do.
    NoOp,
    /// Only the Google-side copy changed — safe to apply it to the local Item.
    ApplyRemote,
    /// Both sides changed since the last sync — never silently pick one;
    /// surface it in the Sync Conflicts list instead.
    Conflict,
}

pub fn decide_pull_action(
    local_updated_at: DateTime<Utc>,
    remote_updated_at: DateTime<Utc>,
    last_synced_at: Option<DateTime<Utc>>,
) -> PullDecision {
    let remote_changed = match last_synced_at {
        Some(ts) => remote_updated_at > ts,
        None => true,
    };
    if !remote_changed {
        return PullDecision::NoOp;
    }

    let local_changed = match last_synced_at {
        Some(ts) => local_updated_at > ts,
        None => true,
    };

    if local_changed {
        PullDecision::Conflict
    } else {
        PullDecision::ApplyRemote
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn t(minute: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 1, 1, 12, minute, 0).unwrap()
    }

    #[test]
    fn neither_side_changed_is_noop() {
        let last_sync = t(0);
        assert_eq!(
            decide_pull_action(last_sync, last_sync, Some(last_sync)),
            PullDecision::NoOp
        );
    }

    #[test]
    fn remote_changed_only_applies_remote() {
        let last_sync = t(0);
        let local_updated_at = last_sync; // unchanged since last sync
        let remote_updated_at = t(5); // changed after last sync
        assert_eq!(
            decide_pull_action(local_updated_at, remote_updated_at, Some(last_sync)),
            PullDecision::ApplyRemote
        );
    }

    #[test]
    fn local_changed_only_is_noop_for_pull() {
        // Local-only changes are the push path's job, not the pull decision's.
        let last_sync = t(0);
        let local_updated_at = t(5);
        let remote_updated_at = last_sync; // unchanged
        assert_eq!(
            decide_pull_action(local_updated_at, remote_updated_at, Some(last_sync)),
            PullDecision::NoOp
        );
    }

    #[test]
    fn both_sides_changed_is_conflict() {
        let last_sync = t(0);
        let local_updated_at = t(3);
        let remote_updated_at = t(5);
        assert_eq!(
            decide_pull_action(local_updated_at, remote_updated_at, Some(last_sync)),
            PullDecision::Conflict
        );
    }

    #[test]
    fn remote_changed_at_exactly_last_sync_time_is_noop() {
        // Strictly-greater-than, not >=: a remote timestamp equal to last_synced_at
        // means "as of our last sync," not "changed since."
        let last_sync = t(0);
        assert_eq!(
            decide_pull_action(last_sync, last_sync, Some(last_sync)),
            PullDecision::NoOp
        );
    }

    #[test]
    fn never_synced_before_is_treated_as_conflict_defensively() {
        // Shouldn't happen in practice (an item can only be matched to a remote
        // id after a push sets last_synced_at), but if it ever does, refuse to
        // guess rather than silently overwrite either side.
        assert_eq!(decide_pull_action(t(1), t(2), None), PullDecision::Conflict);
    }
}

// ---------------------------------------------------------------------------
// Preference helpers
// ---------------------------------------------------------------------------

fn get_pref(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row(
        "SELECT value FROM preference WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .ok()
    .flatten()
}

fn set_pref(conn: &Connection, key: &str, value: &str) {
    let _ = conn.execute(
        "INSERT INTO preference (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    );
}

fn parse_rfc3339(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn non_deleted_items(conn: &Connection) -> Vec<Item> {
    let mut stmt = match conn.prepare(&format!(
        "SELECT {ITEM_COLUMNS} FROM item WHERE deleted_at IS NULL"
    )) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    stmt.query_map([], row_to_item)
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn deleted_items_with_remote_ids(conn: &Connection) -> Vec<Item> {
    let mut stmt = match conn.prepare(&format!(
        "SELECT {ITEM_COLUMNS} FROM item WHERE deleted_at IS NOT NULL \
         AND (google_calendar_id IS NOT NULL OR google_task_id IS NOT NULL)"
    )) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    stmt.query_map([], row_to_item)
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
}

fn record_conflict(
    conn: &Connection,
    item: &Item,
    source: &str,
    remote_snapshot: serde_json::Value,
) {
    let local_snapshot = json!({
        "title": item.title,
        "due_date": item.due_date,
        "due_time": item.due_time,
        "status": item.status,
    });
    let _ = conn.execute(
        "INSERT INTO sync_conflict (id, item_id, source, local_snapshot, remote_snapshot, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            Uuid::new_v4().to_string(),
            item.id,
            source,
            local_snapshot.to_string(),
            remote_snapshot.to_string(),
            now()
        ],
    );
}

fn item_has_open_conflict(conn: &Connection, item_id: &str) -> bool {
    conn.query_row(
        "SELECT 1 FROM sync_conflict WHERE item_id = ?1 LIMIT 1",
        params![item_id],
        |_| Ok(()),
    )
    .optional()
    .ok()
    .flatten()
    .is_some()
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

fn pull_calendar(conn: &Connection, access_token: &str) -> Result<(), String> {
    let stored_token = get_pref(conn, "google_calendar_sync_token");
    let (events, next_sync_token) = match api::list_events(access_token, stored_token.as_deref()) {
        Ok(res) => res,
        Err(e) if e == "SYNC_TOKEN_INVALID" => api::list_events(access_token, None)?,
        Err(e) => return Err(e),
    };

    for event in events {
        apply_remote_calendar_event(conn, &event);
    }

    if let Some(token) = next_sync_token {
        set_pref(conn, "google_calendar_sync_token", &token);
    }
    Ok(())
}

fn apply_remote_calendar_event(conn: &Connection, event: &CalendarEvent) {
    let Some(item) = find_item_by_column(conn, "google_calendar_id", &event.id) else {
        return; // Not one of ours (or already purged) — out of scope, see sync.rs docs.
    };
    let Some(remote_updated_at) = event.updated.as_deref().and_then(parse_rfc3339) else {
        return;
    };
    let last_synced_at = item
        .last_synced_at_calendar
        .as_deref()
        .and_then(parse_rfc3339);
    let local_updated_at = match parse_rfc3339(&item.updated_at) {
        Some(t) => t,
        None => return,
    };

    match decide_pull_action(local_updated_at, remote_updated_at, last_synced_at) {
        PullDecision::NoOp => {}
        PullDecision::Conflict => {
            let remote_snapshot = json!({
                "title": event.summary,
                "due_date": event.start.as_ref().and_then(|s| s.date.clone().or_else(|| s.date_time.clone())),
                "status": event.status,
                "source": "calendar",
            });
            record_conflict(conn, &item, "calendar", remote_snapshot);
        }
        PullDecision::ApplyRemote => {
            if event.status.as_deref() == Some("cancelled") {
                // deliberately doesn't touch updated_at — see the comment below.
                let _ = conn.execute(
                    "UPDATE item SET deleted_at = ?2, last_synced_at_calendar = ?2 WHERE id = ?1",
                    params![item.id, now()],
                );
                return;
            }
            let title = event.summary.clone().unwrap_or(item.title.clone());
            let (due_date, due_time) = match &event.start {
                Some(s) if s.date_time.is_some() => {
                    let dt = s.date_time.clone().unwrap();
                    let mut parts = dt.splitn(2, 'T');
                    let date = parts.next().unwrap_or_default().to_string();
                    let time = parts
                        .next()
                        .map(|t| t.chars().take(5).collect::<String>())
                        .unwrap_or_default();
                    (Some(date), Some(time))
                }
                Some(s) if s.date.is_some() => (s.date.clone(), None),
                _ => (item.due_date.clone(), item.due_time.clone()),
            };
            let ts = now();
            // Deliberately does NOT bump `updated_at`: that column is read
            // elsewhere as "did the user locally edit this" (both by
            // apply_remote_task's own conflict check and by push_items'
            // needs_*_push gate). A calendar-only field sync isn't a local
            // edit, and bumping updated_at here previously caused a routine,
            // content-free calendar re-apply (e.g. right after item creation,
            // before the sync token had caught up) to make a genuinely
            // slightly-earlier Tasks-side change look like a same-cycle local
            // edit — turning a clean ApplyRemote into a false Conflict. Only
            // last_synced_at_calendar advances here.
            let _ = conn.execute(
                "UPDATE item SET title = ?2, due_date = ?3, due_time = ?4, last_synced_at_calendar = ?4 \
                 WHERE id = ?1",
                params![item.id, title, due_date, due_time, ts],
            );
        }
    }
}

fn pull_tasks(conn: &Connection, access_token: &str) -> Result<(), String> {
    let last_sync = get_pref(conn, "google_tasks_last_sync");
    let tasks = api::list_tasks(access_token, last_sync.as_deref())?;

    for task in &tasks {
        apply_remote_task(conn, task);
    }

    set_pref(conn, "google_tasks_last_sync", &now());
    Ok(())
}

fn apply_remote_task(conn: &Connection, task: &Task) {
    let Some(item) = find_item_by_column(conn, "google_task_id", &task.id) else {
        return;
    };
    let Some(remote_updated_at) = task.updated.as_deref().and_then(parse_rfc3339) else {
        return;
    };
    let last_synced_at = item.last_synced_at_tasks.as_deref().and_then(parse_rfc3339);
    let local_updated_at = match parse_rfc3339(&item.updated_at) {
        Some(t) => t,
        None => return,
    };

    match decide_pull_action(local_updated_at, remote_updated_at, last_synced_at) {
        PullDecision::NoOp => {}
        PullDecision::Conflict => {
            let remote_snapshot = json!({
                "title": task.title,
                "due_date": task.due,
                "status": task.status,
                "source": "tasks",
            });
            record_conflict(conn, &item, "tasks", remote_snapshot);
        }
        PullDecision::ApplyRemote => {
            if task.deleted == Some(true) {
                let ts = now();
                let _ = conn.execute(
                    "UPDATE item SET deleted_at = ?2, updated_at = ?2, last_synced_at_tasks = ?2 WHERE id = ?1",
                    params![item.id, ts],
                );
                return;
            }
            let title = task.title.clone().unwrap_or(item.title.clone());
            // A completed Google Task flips the Item to Completed and vice versa
            // (spec §7.2) — the reverse direction (local → Google) is in push_items.
            let status = if task.status.as_deref() == Some("completed") {
                "Completed"
            } else if item.status == "Completed" {
                "In Progress"
            } else {
                item.status.as_str()
            };
            let ts = now();
            // Only last_synced_at_tasks advances here — see the comment on
            // apply_remote_calendar_event's equivalent write.
            let _ = conn.execute(
                "UPDATE item SET title = ?2, status = ?3, updated_at = ?4, last_synced_at_tasks = ?4 WHERE id = ?1",
                params![item.id, title, status, ts],
            );
        }
    }
}

fn find_item_by_column(conn: &Connection, column: &str, value: &str) -> Option<Item> {
    conn.query_row(
        &format!("SELECT {ITEM_COLUMNS} FROM item WHERE {column} = ?1 AND deleted_at IS NULL"),
        params![value],
        row_to_item,
    )
    .optional()
    .ok()
    .flatten()
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

fn push_items(conn: &Connection, access_token: &str) -> Result<(), String> {
    for item in non_deleted_items(conn) {
        if item_has_open_conflict(conn, &item.id) {
            continue; // don't push over an unresolved conflict
        }

        let local_updated_at = match parse_rfc3339(&item.updated_at) {
            Some(t) => t,
            None => continue,
        };
        // Calendar and Tasks are gated independently — each only needs a push
        // if *its own* last_synced_at is behind the local edit. A pull that
        // just refreshed one channel's timestamp must not suppress a push the
        // other channel still needs (the mirror image of the pull-side bug
        // documented in db.rs / apply_remote_*).
        let needs_calendar_push = item.due_date.is_some()
            && match item
                .last_synced_at_calendar
                .as_deref()
                .and_then(parse_rfc3339)
            {
                Some(ts) => local_updated_at > ts,
                None => true,
            };
        let needs_task_push = match item.last_synced_at_tasks.as_deref().and_then(parse_rfc3339) {
            Some(ts) => local_updated_at > ts,
            None => true,
        };
        if !needs_calendar_push && !needs_task_push {
            continue;
        }

        let mut new_calendar_id = item.google_calendar_id.clone();
        let mut new_task_id = item.google_task_id.clone();
        let mut calendar_ok = false;
        let mut task_ok = false;

        if needs_calendar_push {
            if let Some(due_date) = &item.due_date {
                let body = api::event_body(
                    &item.title,
                    item.notes.as_deref(),
                    due_date,
                    item.due_time.as_deref(),
                    item.estimated_duration.map(|d| d as i64),
                );
                let result = match &item.google_calendar_id {
                    Some(id) => api::update_event(access_token, id, &body),
                    None => api::create_event(access_token, &body),
                };
                match result {
                    Ok(event) => {
                        new_calendar_id = Some(event.id);
                        calendar_ok = true;
                    }
                    Err(e) => {
                        eprintln!(
                            "[google sync] push calendar event failed for item {}: {e}",
                            item.id
                        );
                    }
                }
            }
        }

        if needs_task_push {
            let body = api::task_body(
                &item.title,
                item.notes.as_deref(),
                item.due_date.as_deref(),
                item.status == "Completed",
            );
            let result = match &item.google_task_id {
                Some(id) => api::update_task(access_token, id, &body),
                None => api::create_task(access_token, &body),
            };
            match result {
                Ok(task) => {
                    new_task_id = Some(task.id);
                    task_ok = true;
                }
                Err(e) => {
                    eprintln!("[google sync] push task failed for item {}: {e}", item.id);
                }
            }
        }

        // Persist whichever id(s) did succeed either way, but only advance
        // each channel's own last_synced_at when that channel's push actually
        // succeeded — a failed push must keep retrying next cycle, and a
        // channel that wasn't attempted this cycle must not have its
        // timestamp touched at all.
        let ts = now();
        let _ = conn.execute(
            "UPDATE item SET google_calendar_id = ?2, google_task_id = ?3 WHERE id = ?1",
            params![item.id, new_calendar_id, new_task_id],
        );
        if calendar_ok {
            let _ = conn.execute(
                "UPDATE item SET last_synced_at_calendar = ?2 WHERE id = ?1",
                params![item.id, ts],
            );
        }
        if task_ok {
            let _ = conn.execute(
                "UPDATE item SET last_synced_at_tasks = ?2 WHERE id = ?1",
                params![item.id, ts],
            );
        }
    }
    Ok(())
}

fn push_deletions(conn: &Connection, access_token: &str) {
    for item in deleted_items_with_remote_ids(conn) {
        let mut ok = true;
        if let Some(id) = &item.google_calendar_id {
            ok &= api::delete_event(access_token, id).is_ok();
        }
        if let Some(id) = &item.google_task_id {
            ok &= api::delete_task(access_token, id).is_ok();
        }
        if ok {
            // Confirmed removed on the Google side — safe to purge locally (spec §7.4).
            let _ = conn.execute("DELETE FROM item WHERE id = ?1", params![item.id]);
        }
    }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

pub fn run_sync(conn: &Connection) -> Result<(), String> {
    if !oauth::is_connected(conn) {
        return Ok(()); // not connected — silently skip, nothing to sync
    }
    let access_token = oauth::get_valid_access_token(conn)?;

    pull_calendar(conn, &access_token)?;
    pull_tasks(conn, &access_token)?;
    push_items(conn, &access_token)?;
    push_deletions(conn, &access_token);

    Ok(())
}

/// Runs on its own OS thread with its own SQLite connection (WAL mode lets it
/// coexist with the frontend's shared connection and the notification
/// thread's) so a slow network round-trip during sync never blocks other
/// DB-backed commands. Fires once immediately on launch, then on the
/// configured interval — matching spec §7.2's triggers (launch + periodic;
/// "Sync now" is the separate `sync_now` command) — or as soon as it's woken
/// early via the returned `SyncTrigger` (e.g. right after a local delete, so
/// the remote event/task doesn't sit orphaned for a full interval).
pub fn spawn(app: tauri::AppHandle, db_path: PathBuf) -> SyncTrigger {
    let (tx, rx) = mpsc::channel::<()>();
    std::thread::spawn(move || {
        let conn = match crate::db::init(&db_path) {
            Ok(c) => c,
            Err(_) => return,
        };
        loop {
            // A dead refresh token (revoked, or expired after 7 days on an
            // unverified OAuth consent screen) can't fix itself by retrying —
            // oauth::refresh_access_token already clears the stored tokens
            // when it detects this, so is_connected() goes false and this
            // loop just quietly stops touching Google until reconnected.
            // What it can't do on its own is tell the user *why* sync
            // stopped, since nothing else is watching this background
            // thread — that's what the notification is for.
            if let Err(e) = run_sync(&conn) {
                if e == oauth::RECONNECT_REQUIRED {
                    crate::notifications::notify(
                        &app,
                        "Google connection expired",
                        "Reconnect your Google account in Settings to resume Calendar/Tasks sync.",
                    );
                }
            }

            let interval_minutes: u64 = get_pref(&conn, "sync_interval_minutes")
                .and_then(|v| v.parse().ok())
                .unwrap_or(5);
            let interval = Duration::from_secs(interval_minutes * 60).max(SYNC_INTERVAL_FLOOR);
            // Waking up on a trigger drains any extra pending signals first
            // (several deletes fired in quick succession shouldn't queue up
            // that many extra sync cycles back to back) then loops straight
            // into another run_sync rather than sleeping out the rest of the
            // interval. A closed channel (should only happen at app
            // shutdown) falls back to a plain sleep instead of busy-looping.
            match rx.recv_timeout(interval) {
                Ok(()) | Err(mpsc::RecvTimeoutError::Timeout) => while rx.try_recv().is_ok() {},
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    std::thread::sleep(interval);
                }
            }
        }
    });
    SyncTrigger(Mutex::new(tx))
}
