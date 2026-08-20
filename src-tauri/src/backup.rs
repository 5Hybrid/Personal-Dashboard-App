use crate::db::DbPathState;
use chrono::Utc;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{AppHandle, State};
use uuid::Uuid;

const CHECK_INTERVAL: Duration = Duration::from_secs(60);
const QUIET_PERIOD: chrono::Duration = chrono::Duration::minutes(5);

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

/// Stable per-install identifier, generated once and copied verbatim into
/// every backup snapshot (VACUUM INTO copies the whole `preference` table
/// as-is) — this is how a device recognizes "that's my own backup" and
/// skips prompting to restore its own just-pushed snapshot back onto itself.
fn ensure_device_id(conn: &Connection) -> String {
    if let Some(id) = get_pref(conn, "device_id") {
        return id;
    }
    let id = Uuid::new_v4().to_string();
    set_pref(conn, "device_id", &id);
    id
}

fn backup_path(folder: &str) -> PathBuf {
    Path::new(folder).join("life-os-backup.sqlite3")
}

/// Snapshots the whole DB to `<folder>/life-os-backup.sqlite3` via SQLite's
/// own VACUUM INTO — safe to run against a live WAL-mode connection, unlike
/// copying the raw .sqlite3/-wal/-shm files by hand, which can race a
/// concurrent writer and produce an inconsistent copy. There's no cloud
/// backend by design, so pointing `folder` at a Drive/Dropbox/OneDrive
/// folder is what gives this its actual off-machine safety net.
pub fn run_backup(conn: &Connection, folder: &str) -> Result<(), String> {
    if folder.trim().is_empty() {
        return Err("No backup folder configured".to_string());
    }
    ensure_device_id(conn);
    // Set *before* VACUUM INTO so the snapshot's own copy of this row already
    // reflects the exact moment it was taken. Setting it after would leave
    // the file that lands in the shared folder carrying the *previous*
    // backup's timestamp, and the other device's "is this newer than what
    // I've already seen" check (check_remote_backup, below) would then never
    // recognize it as new.
    set_pref(conn, "last_backup_at", &Utc::now().to_rfc3339());
    let dest = backup_path(folder);
    let _ = std::fs::remove_file(&dest); // VACUUM INTO refuses to write over an existing file
    conn.execute("VACUUM INTO ?1", params![dest.to_string_lossy()])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Latest timestamp across the tables a user actually edits day-to-day.
fn parse_rfc3339(s: Option<String>) -> Option<chrono::DateTime<Utc>> {
    s.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
        .map(|d| d.with_timezone(&Utc))
}

/// Pure decision logic (no I/O), kept separate from `tick` so it can be unit
/// tested directly against fixed timestamps — the same split google::sync
/// uses for `decide_pull_action`.
///
/// `last_activity_at` comes from `preference.last_activity_at`, which every
/// mutating command touches (see commands::touch_activity) — deliberately
/// *not* derived by scanning table timestamp columns, which is what this
/// replaced: `context` (Class/Project/Program) has no timestamp columns of
/// its own, so that approach silently never counted editing a class as
/// "activity," and the automatic backup could go stale for that data
/// specifically. An explicit touch-on-write doesn't have that blind spot,
/// for this table or any future one.
fn is_backup_due(
    now: chrono::DateTime<Utc>,
    last_backup_at: Option<chrono::DateTime<Utc>>,
    last_activity_at: Option<chrono::DateTime<Utc>>,
    interval_hours: i64,
) -> bool {
    let interval_due = match last_backup_at {
        Some(last) => now - last >= chrono::Duration::hours(interval_hours),
        None => true,
    };

    // Backs up roughly QUIET_PERIOD after the user stops editing, in addition
    // to the fixed interval above, so the shared folder is rarely more than a
    // few minutes stale for whichever device picks it up next (see
    // check_remote_backup / restore_from_backup).
    let activity_due = match (last_activity_at, last_backup_at) {
        (Some(activity), Some(last)) if activity > last => now - activity >= QUIET_PERIOD,
        (Some(_), None) => true,
        _ => false,
    };

    interval_due || activity_due
}

fn tick(conn: &Connection) {
    let Some(folder) = get_pref(conn, "backup_folder_path").filter(|f| !f.trim().is_empty()) else {
        return; // not configured yet
    };
    let interval_hours: i64 = get_pref(conn, "backup_interval_hours")
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);
    let last_backup_at = parse_rfc3339(get_pref(conn, "last_backup_at"));
    let last_activity_at = parse_rfc3339(get_pref(conn, "last_activity_at"));

    if is_backup_due(Utc::now(), last_backup_at, last_activity_at, interval_hours) {
        if let Err(e) = run_backup(conn, &folder) {
            eprintln!("[backup] failed: {e}");
        }
    }
}

/// Runs on its own OS thread with its own SQLite connection, matching
/// notifications::spawn / google::sync::spawn. Polls once a minute (rather
/// than sleeping a full interval) so both the daily fallback and the
/// activity-quiet-period backup fire promptly once they're actually due.
pub fn spawn(db_path: PathBuf) {
    std::thread::spawn(move || {
        let conn = match crate::db::init(&db_path) {
            Ok(c) => c,
            Err(_) => return,
        };
        loop {
            tick(&conn);
            std::thread::sleep(CHECK_INTERVAL);
        }
    });
}

#[tauri::command]
pub fn backup_now(state: State<DbPathState>) -> Result<(), String> {
    let conn = crate::db::init(&state.0).map_err(|e| e.to_string())?;
    let folder = get_pref(&conn, "backup_folder_path").unwrap_or_default();
    run_backup(&conn, &folder)
}

#[derive(Serialize)]
pub struct RemoteBackupStatus {
    pub written_at: String,
}

/// Opens the shared-folder snapshot read-only (never writes to it, never
/// creates -wal/-shm sidecars for it) and compares its embedded
/// `last_backup_at`/`device_id` against what this device has already seen.
/// Returns `Ok(None)` for every "nothing to do" case (no folder configured,
/// no file yet, it's this device's own last push, or it's a snapshot already
/// offered and dismissed) rather than an error — a cloud client mid-download
/// or a stale/partial file is an expected, transient state here, not a
/// failure worth surfacing to the UI.
/// Free of Tauri's `State`/command plumbing so it can be exercised directly
/// against real temp files in tests, the same way google::sync separates its
/// decision logic from the command wrapper around it.
fn check_remote_backup_impl(local: &Connection, folder: &str) -> Option<RemoteBackupStatus> {
    if folder.trim().is_empty() {
        return None;
    }
    let local_device_id = ensure_device_id(local);
    let last_remote_seen_at = get_pref(local, "last_remote_seen_at").unwrap_or_default();

    let path = backup_path(folder);
    if !path.exists() {
        return None;
    }
    let remote = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
    let remote_device_id = get_pref(&remote, "device_id")?;
    let remote_written_at = get_pref(&remote, "last_backup_at")?;

    if remote_device_id == local_device_id {
        return None; // our own last push
    }
    if remote_written_at <= last_remote_seen_at {
        return None; // already offered (and either accepted or dismissed)
    }
    Some(RemoteBackupStatus {
        written_at: remote_written_at,
    })
}

#[tauri::command]
pub fn check_remote_backup(state: State<DbPathState>) -> Result<Option<RemoteBackupStatus>, String> {
    let local = crate::db::init(&state.0).map_err(|e| e.to_string())?;
    let folder = get_pref(&local, "backup_folder_path").unwrap_or_default();
    Ok(check_remote_backup_impl(&local, &folder))
}

/// Records that the user has been offered this snapshot — whether they
/// loaded it or chose "keep local" — so check_remote_backup stops
/// re-prompting for the same one on every poll/launch.
#[tauri::command]
pub fn dismiss_remote_backup(state: State<DbPathState>, written_at: String) -> Result<(), String> {
    let conn = crate::db::init(&state.0).map_err(|e| e.to_string())?;
    set_pref(&conn, "last_remote_seen_at", &written_at);
    Ok(())
}

/// Stages the shared-folder snapshot next to the live DB and marks it for
/// the *next* launch to pick up, then restarts the app. Applying it live
/// right now would mean swapping the file out from under this process's own
/// open connection plus the notifications/Google-sync/backup threads'
/// independent connections; a restart sidesteps that entirely — the marker
/// is applied in `lib.rs` (`apply_pending_restore`) before any connection to
/// the file is opened for the new run.
/// Stages the shared-folder snapshot and writes the marker `apply_pending_restore`
/// looks for, without touching Tauri's `State`/`AppHandle` — kept separate so
/// the staging step can be tested directly, and so the (untestable, process-
/// exiting) `app.restart()` call is the last thing the command wrapper does.
fn stage_restore(db_path: &Path, folder: &str, written_at: &str) -> Result<(), String> {
    let remote_path = backup_path(folder);
    let remote = Connection::open_with_flags(&remote_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let actual_written_at = get_pref(&remote, "last_backup_at").unwrap_or_default();
    drop(remote);
    if actual_written_at != written_at {
        return Err(
            "The backup in the shared folder changed since it was found — try again.".to_string(),
        );
    }

    let staging_path = db_path.with_extension("sqlite3.incoming");
    std::fs::copy(&remote_path, &staging_path).map_err(|e| e.to_string())?;
    let marker_path = db_path.with_extension("sqlite3.pending-restore");
    std::fs::write(&marker_path, staging_path.to_string_lossy().as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_from_backup(
    app: AppHandle,
    state: State<DbPathState>,
    written_at: String,
) -> Result<(), String> {
    let db_path = state.0.clone();
    let conn = crate::db::init(&db_path).map_err(|e| e.to_string())?;
    let folder = get_pref(&conn, "backup_folder_path").unwrap_or_default();
    set_pref(&conn, "last_remote_seen_at", &written_at);
    drop(conn);

    stage_restore(&db_path, &folder, &written_at)?;
    app.restart();
}

/// If `restore_from_backup` staged a snapshot on the previous run, swap it
/// into place now — called from `lib.rs::setup()` before any connection to
/// `db_path` exists for this process, which is what makes the swap safe: no
/// live connection or background thread has the old file open to be confused
/// by it disappearing out from under them mid-run.
pub fn apply_pending_restore(db_path: &Path) {
    let marker_path = db_path.with_extension("sqlite3.pending-restore");
    let Ok(staged) = std::fs::read_to_string(&marker_path) else {
        return;
    };
    let staged_path = PathBuf::from(staged.trim());
    if staged_path.exists() {
        let _ = std::fs::remove_file(db_path);
        let _ = std::fs::remove_file(db_path.with_extension("sqlite3-wal"));
        let _ = std::fs::remove_file(db_path.with_extension("sqlite3-shm"));
        let _ = std::fs::rename(&staged_path, db_path);
    }
    let _ = std::fs::remove_file(&marker_path);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Fresh, uniquely-named scratch directory under the OS temp dir — each
    /// test gets its own so `cargo test`'s parallel execution can't collide.
    fn scratch_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("life-os-backup-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn insert_marker_item(conn: &Connection, id: &str, title: &str) {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO item (id, title, category, created_at, updated_at) VALUES (?1, ?2, 'Personal', ?3, ?3)",
            params![id, title, now],
        )
        .unwrap();
    }

    fn t(minute: u32) -> chrono::DateTime<Utc> {
        use chrono::TimeZone;
        Utc.with_ymd_and_hms(2026, 1, 1, 12, minute, 0).unwrap()
    }

    #[test]
    fn never_backed_up_before_is_always_due() {
        assert!(is_backup_due(t(0), None, None, 24));
    }

    #[test]
    fn quiet_period_not_yet_elapsed_is_not_due() {
        let last_backup = t(0);
        let activity = t(1); // changed 1 minute after the last backup
        let now = t(4); // only 4 minutes since that change — QUIET_PERIOD is 5
        assert!(!is_backup_due(now, Some(last_backup), Some(activity), 24));
    }

    #[test]
    fn quiet_period_elapsed_since_activity_is_due() {
        let last_backup = t(0);
        let activity = t(1);
        let now = t(10); // 9 minutes of quiet since the change
        assert!(is_backup_due(now, Some(last_backup), Some(activity), 24));
    }

    #[test]
    fn activity_at_or_before_last_backup_does_not_force_a_backup() {
        // Nothing changed since the last backup — the daily interval alone governs.
        let last_backup = t(10);
        let activity = t(5); // stale — predates the last backup
        let now = t(30);
        assert!(!is_backup_due(now, Some(last_backup), Some(activity), 24));
    }

    #[test]
    fn daily_interval_forces_a_backup_even_without_activity() {
        let last_backup = t(0);
        let now = last_backup + chrono::Duration::hours(25);
        assert!(is_backup_due(now, Some(last_backup), None, 24));
    }

    /// Regression test for the reported bug: creating a Class (a `context`
    /// row) alone must mark activity, even though that table has no
    /// timestamp columns of its own to be scanned for. This exercises
    /// commands::touch_activity directly against a real DB, not just
    /// is_backup_due's pure logic above.
    #[test]
    fn creating_a_context_alone_counts_as_activity() {
        let conn = crate::db::init(&scratch_dir().join("life-os.sqlite3")).unwrap();
        conn.execute(
            "INSERT INTO context (id, type, name) VALUES ('ctx-1', 'Class', 'CS 101')",
            [],
        )
        .unwrap();
        assert!(get_pref(&conn, "last_activity_at").is_none()); // not touched yet

        crate::commands::touch_activity(&conn);

        let last_activity_at = get_pref(&conn, "last_activity_at");
        assert!(last_activity_at.is_some());
        // With no backup yet at all, that alone should make a backup due.
        assert!(is_backup_due(Utc::now(), None, parse_rfc3339(last_activity_at), 24));
    }

    #[test]
    fn check_remote_backup_sees_another_devices_push_but_not_its_own() {
        let shared = scratch_dir();
        let folder = shared.to_string_lossy().to_string();

        let a = crate::db::init(&scratch_dir().join("life-os.sqlite3")).unwrap();
        let b = crate::db::init(&scratch_dir().join("life-os.sqlite3")).unwrap();

        run_backup(&a, &folder).expect("backup should succeed");

        // The device that just pushed shouldn't be offered its own backup back.
        assert!(check_remote_backup_impl(&a, &folder).is_none());

        // A different device should see it as new.
        let status = check_remote_backup_impl(&b, &folder).expect("b should see a's push");
        assert_eq!(status.written_at, get_pref(&a, "last_backup_at").unwrap());

        // Once dismissed (or restored — restore_from_backup sets the same
        // pref before staging), the same snapshot shouldn't resurface.
        set_pref(&b, "last_remote_seen_at", &status.written_at);
        assert!(check_remote_backup_impl(&b, &folder).is_none());
    }

    #[test]
    fn stage_restore_and_apply_pending_restore_replace_local_db_with_remote_snapshot() {
        let shared = scratch_dir();
        let folder = shared.to_string_lossy().to_string();

        let a_dir = scratch_dir();
        let a_db_path = a_dir.join("life-os.sqlite3");
        let a = crate::db::init(&a_db_path).unwrap();
        insert_marker_item(&a, "item-a", "From device A");
        run_backup(&a, &folder).unwrap();
        let written_at = get_pref(&a, "last_backup_at").unwrap();
        let a_device_id = get_pref(&a, "device_id").unwrap();
        drop(a);

        let b_dir = scratch_dir();
        let b_db_path = b_dir.join("life-os.sqlite3");
        let b = crate::db::init(&b_db_path).unwrap();
        insert_marker_item(&b, "item-b", "From device B, should be gone after restore");
        drop(b);

        stage_restore(&b_db_path, &folder, &written_at).expect("staging should succeed");
        apply_pending_restore(&b_db_path);

        let restored = crate::db::init(&b_db_path).unwrap();
        assert_eq!(get_pref(&restored, "device_id").unwrap(), a_device_id);
        let titles: Vec<String> = restored
            .prepare("SELECT title FROM item ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(titles, vec!["From device A".to_string()]);
    }

    #[test]
    fn stage_restore_rejects_a_snapshot_that_changed_since_it_was_found() {
        let shared = scratch_dir();
        let folder = shared.to_string_lossy().to_string();
        let a = crate::db::init(&scratch_dir().join("life-os.sqlite3")).unwrap();
        run_backup(&a, &folder).unwrap();

        let b_db_path = scratch_dir().join("life-os.sqlite3");
        let err = stage_restore(&b_db_path, &folder, "2020-01-01T00:00:00Z")
            .expect_err("stale written_at should be rejected");
        assert!(err.contains("changed since it was found"));
    }
}
