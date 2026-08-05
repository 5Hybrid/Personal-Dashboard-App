use crate::db::DbPathState;
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::State;

const CHECK_INTERVAL: Duration = Duration::from_secs(60 * 60);

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
    let dest = Path::new(folder).join("life-os-backup.sqlite3");
    let _ = std::fs::remove_file(&dest); // VACUUM INTO refuses to write over an existing file
    conn.execute("VACUUM INTO ?1", params![dest.to_string_lossy()])
        .map_err(|e| e.to_string())?;
    set_pref(conn, "last_backup_at", &Utc::now().to_rfc3339());
    Ok(())
}

fn tick(conn: &Connection) {
    let Some(folder) = get_pref(conn, "backup_folder_path").filter(|f| !f.trim().is_empty()) else {
        return; // not configured yet
    };
    let interval_hours: i64 = get_pref(conn, "backup_interval_hours")
        .and_then(|v| v.parse().ok())
        .unwrap_or(24);
    let due = match get_pref(conn, "last_backup_at").and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok()) {
        Some(last) => Utc::now() - last.with_timezone(&Utc) >= chrono::Duration::hours(interval_hours),
        None => true,
    };
    if due {
        if let Err(e) = run_backup(conn, &folder) {
            eprintln!("[backup] failed: {e}");
        }
    }
}

/// Runs on its own OS thread with its own SQLite connection, matching
/// notifications::spawn / google::sync::spawn. Checks hourly whether a
/// backup is due (rather than sleeping the full configured interval) so a
/// changed `backup_interval_hours` takes effect within the hour instead of
/// waiting out whatever the previous interval was.
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
