use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

pub struct DbState(pub Mutex<Connection>);

/// The DB file path, managed separately from `DbState` so background work
/// (Google OAuth's blocking browser wait, the sync loop) can open its own
/// independent connection instead of holding the single shared Mutex for the
/// duration of a network round-trip — that would freeze every other DB-backed
/// command in the app for as long as sync/auth takes.
pub struct DbPathState(pub PathBuf);

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS context (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('Class','Project','Program')),
  name TEXT NOT NULL,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Archived')),
  term TEXT,
  schedule TEXT,
  owner TEXT,
  grade_scale TEXT,
  grade_cutoffs TEXT
);

CREATE TABLE IF NOT EXISTS item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN
    ('School','Work','Gym','Personal','Finance','Projects','Relationships','Health','Travel','Custom')),
  subcategory_id TEXT REFERENCES context(id),
  subcategory_text TEXT,
  due_date TEXT,
  due_time TEXT,
  estimated_duration INTEGER,
  priority TEXT CHECK (priority IN ('Low','Medium','High')) DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Not Started' CHECK (status IN ('Not Started','In Progress','Completed')),
  repeat_settings TEXT,
  color TEXT,
  notes TEXT,
  tags TEXT,
  attachments TEXT,

  google_calendar_id TEXT,
  google_task_id TEXT,
  -- Kept separate rather than one shared `last_synced_at`: Calendar and Tasks
  -- are independent remote timelines with their own update clocks, and
  -- run_sync pulls calendar before tasks — a shared column let a same-cycle
  -- calendar-side touch (e.g. re-detecting its own just-created event due to
  -- clock skew) advance the timestamp past a genuine, slightly-earlier Tasks
  -- change, permanently hiding it from decide_pull_action. See sync.rs.
  last_synced_at_calendar TEXT,
  last_synced_at_tasks TEXT,

  assignment_type TEXT,
  points_earned REAL,
  points_possible REAL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_item_category ON item(category);
CREATE INDEX IF NOT EXISTS idx_item_subcategory_id ON item(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_item_due_date ON item(due_date);
CREATE INDEX IF NOT EXISTS idx_item_deleted_at ON item(deleted_at);

-- Raw Inbox captures: title + optional freeform text, no category yet.
-- Kept separate from `item` because item.category is NOT NULL in the locked schema;
-- an inbox_item is promoted into a real Item (via create_item) by the Process flow,
-- then removed from this table.
CREATE TABLE IF NOT EXISTS inbox_item (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL
);

-- Freeform notes scoped to a Context (e.g. a Class), optionally linked to one
-- specific Item (an assignment). Kept as its own table since neither `context`
-- nor `item` has room for an arbitrary number of freeform notes per assignment.
CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  context_id TEXT NOT NULL REFERENCES context(id),
  item_id TEXT REFERENCES item(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_context_id ON note(context_id);

-- Dashboard "Quick Notes": a freeform scratchpad, unlike `note` which is
-- always scoped to a Context. Add/delete only — no per-note editing, matching
-- how it's used (jot something down, clear it later).
CREATE TABLE IF NOT EXISTS quick_note (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Gym Personal Records: keyed to exercise name + current best value, not date-bound,
-- so (per the build prompt) they don't fit the Item model and get their own table.
CREATE TABLE IF NOT EXISTS personal_record (
  id TEXT PRIMARY KEY,
  program_id TEXT REFERENCES context(id),
  exercise_name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Generic key/value settings store (notification times, lead hours, toggles).
-- Phase 11 (Settings) is the UI on top of this; Phase 9 just needs somewhere
-- to keep the scheduler's configuration and defaults.
CREATE TABLE IF NOT EXISTS preference (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tracks which (item, notification type) pairs have already fired, so the
-- background poll loop (which re-evaluates every tick) fires Overdue/Upcoming
-- Deadline notifications exactly once per item rather than every tick.
CREATE TABLE IF NOT EXISTS notification_log (
  item_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  fired_at TEXT NOT NULL,
  PRIMARY KEY (item_id, notification_type)
);

-- Surfaced when both the local Item and its Google-side counterpart changed
-- since last_synced_at (spec §7.2) — never silently overwritten, resolved by
-- the user picking "keep mine" or "keep Google's" in the Sync Conflicts list.
CREATE TABLE IF NOT EXISTS sync_conflict (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES item(id),
  source TEXT NOT NULL CHECK (source IN ('calendar','tasks')),
  local_snapshot TEXT NOT NULL,
  remote_snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"#;

pub fn init(db_path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    // WAL mode lets multiple connections to the same file coexist (the
    // frontend's shared connection, the notification thread's, the Google
    // sync thread's) — busy_timeout makes brief writer contention between
    // them wait-and-retry instead of failing immediately with SQLITE_BUSY.
    conn.busy_timeout(Duration::from_secs(5))?;
    conn.execute_batch(SCHEMA)?;
    migrate_split_last_synced_at(&conn)?;
    Ok(conn)
}

/// One-time migration for DBs created before `last_synced_at` was split into
/// per-channel columns (see the comment on `item` above). Safe to run on
/// every startup — it's a no-op once the old column is gone.
fn migrate_split_last_synced_at(conn: &Connection) -> rusqlite::Result<()> {
    let has_old_column: bool = conn
        .prepare("SELECT 1 FROM pragma_table_info('item') WHERE name = 'last_synced_at'")?
        .exists([])?;
    if !has_old_column {
        return Ok(());
    }
    conn.execute_batch(
        "ALTER TABLE item ADD COLUMN last_synced_at_calendar TEXT;
         ALTER TABLE item ADD COLUMN last_synced_at_tasks TEXT;
         UPDATE item SET last_synced_at_calendar = last_synced_at, last_synced_at_tasks = last_synced_at;
         ALTER TABLE item DROP COLUMN last_synced_at;",
    )
}
