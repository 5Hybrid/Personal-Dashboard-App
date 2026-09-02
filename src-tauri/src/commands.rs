use crate::db::DbState;
use crate::models::{
    Context, ContextInput, InboxItem, InboxItemInput, Item, ItemInput, Note, NoteInput,
    PersonalRecord, PersonalRecordInput, QuickNote, QuickNoteInput,
};
use rusqlite::{params, Connection, OptionalExtension, Row};
use tauri::State;
use uuid::Uuid;

pub(crate) fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Marks `preference.last_activity_at`, which backup.rs's automatic-backup
/// timer watches to decide when a fresh snapshot is due (see
/// backup::tick/is_backup_due). Every mutating command below calls this.
/// Previously that timer instead scanned `item`/`note`/`personal_record`/
/// `inbox_item`/`quick_note` directly for their most recent timestamp —
/// `context` (Class/Project/Program) has no timestamp columns of its own, so
/// it was silently excluded, and creating/editing a class alone never
/// triggered an automatic backup. An explicit touch on every command sidesteps
/// that: it doesn't matter whether a table has timestamp columns, and a future
/// table can't be forgotten the way `context` was.
pub(crate) fn touch_activity(conn: &Connection) {
    let _ = conn.execute(
        "INSERT INTO preference (key, value) VALUES ('last_activity_at', ?1) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![now()],
    );
}

fn json_to_text(value: &Option<serde_json::Value>) -> Option<String> {
    value.as_ref().map(|v| v.to_string())
}

fn text_to_json(text: Option<String>) -> Option<serde_json::Value> {
    text.and_then(|t| serde_json::from_str(&t).ok())
}

fn vec_to_text(value: &Option<Vec<String>>) -> Option<String> {
    value
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_else(|_| "[]".to_string()))
}

fn text_to_vec(text: Option<String>) -> Option<Vec<String>> {
    text.and_then(|t| serde_json::from_str(&t).ok())
}

fn row_to_context(row: &Row) -> rusqlite::Result<Context> {
    Ok(Context {
        id: row.get("id")?,
        type_: row.get("type")?,
        name: row.get("name")?,
        color: row.get("color")?,
        status: row.get("status")?,
        term: row.get("term")?,
        schedule: row.get("schedule")?,
        owner: row.get("owner")?,
        grade_scale: text_to_json(row.get("grade_scale")?),
        grade_cutoffs: text_to_json(row.get("grade_cutoffs")?),
    })
}

pub(crate) fn row_to_item(row: &Row) -> rusqlite::Result<Item> {
    Ok(Item {
        id: row.get("id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        category: row.get("category")?,
        subcategory_id: row.get("subcategory_id")?,
        subcategory_text: row.get("subcategory_text")?,
        due_date: row.get("due_date")?,
        due_time: row.get("due_time")?,
        estimated_duration: row.get("estimated_duration")?,
        priority: row.get("priority")?,
        status: row.get("status")?,
        repeat_settings: row.get("repeat_settings")?,
        color: row.get("color")?,
        notes: row.get("notes")?,
        tags: text_to_vec(row.get("tags")?),
        attachments: text_to_vec(row.get("attachments")?),
        google_calendar_id: row.get("google_calendar_id")?,
        google_task_id: row.get("google_task_id")?,
        last_synced_at_calendar: row.get("last_synced_at_calendar")?,
        last_synced_at_tasks: row.get("last_synced_at_tasks")?,
        assignment_type: row.get("assignment_type")?,
        points_earned: row.get("points_earned")?,
        points_possible: row.get("points_possible")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        deleted_at: row.get("deleted_at")?,
    })
}

const CONTEXT_COLUMNS: &str =
    "id, type, name, color, status, term, schedule, owner, grade_scale, grade_cutoffs";

pub(crate) const ITEM_COLUMNS: &str = "id, title, description, category, subcategory_id, subcategory_text, \
    due_date, due_time, estimated_duration, priority, status, repeat_settings, color, notes, \
    tags, attachments, google_calendar_id, google_task_id, last_synced_at_calendar, last_synced_at_tasks, \
    assignment_type, points_earned, points_possible, created_at, updated_at, deleted_at";

#[tauri::command]
pub fn create_context(state: State<DbState>, input: ContextInput) -> Result<Context, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let context = Context {
        id: Uuid::new_v4().to_string(),
        type_: input.type_,
        name: input.name,
        color: input.color,
        status: input.status.unwrap_or_else(|| "Active".to_string()),
        term: input.term,
        schedule: input.schedule,
        owner: input.owner,
        grade_scale: input.grade_scale,
        grade_cutoffs: input.grade_cutoffs,
    };
    conn.execute(
        &format!("INSERT INTO context ({CONTEXT_COLUMNS}) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"),
        params![
            context.id,
            context.type_,
            context.name,
            context.color,
            context.status,
            context.term,
            context.schedule,
            context.owner,
            json_to_text(&context.grade_scale),
            json_to_text(&context.grade_cutoffs),
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(context)
}

#[tauri::command]
pub fn update_context(state: State<DbState>, context: Context) -> Result<Context, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE context SET type=?2, name=?3, color=?4, status=?5, term=?6, schedule=?7, \
         owner=?8, grade_scale=?9, grade_cutoffs=?10 WHERE id=?1",
        params![
            context.id,
            context.type_,
            context.name,
            context.color,
            context.status,
            context.term,
            context.schedule,
            context.owner,
            json_to_text(&context.grade_scale),
            json_to_text(&context.grade_cutoffs),
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(context)
}

#[tauri::command]
pub fn list_contexts(state: State<DbState>) -> Result<Vec<Context>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {CONTEXT_COLUMNS} FROM context ORDER BY name"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_context)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_item(state: State<DbState>, input: ItemInput) -> Result<Item, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let timestamp = now();
    let item = Item {
        id: Uuid::new_v4().to_string(),
        title: input.title,
        description: input.description,
        category: input.category,
        subcategory_id: input.subcategory_id,
        subcategory_text: input.subcategory_text,
        due_date: input.due_date,
        due_time: input.due_time,
        estimated_duration: input.estimated_duration,
        priority: input.priority.unwrap_or_else(|| "Medium".to_string()),
        status: input.status.unwrap_or_else(|| "Not Started".to_string()),
        repeat_settings: input.repeat_settings,
        color: input.color,
        notes: input.notes,
        tags: input.tags,
        attachments: input.attachments,
        google_calendar_id: None,
        google_task_id: None,
        last_synced_at_calendar: None,
        last_synced_at_tasks: None,
        assignment_type: input.assignment_type,
        points_earned: input.points_earned,
        points_possible: input.points_possible,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        deleted_at: None,
    };
    conn.execute(
        &format!(
            "INSERT INTO item ({ITEM_COLUMNS}) VALUES \
             (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26)"
        ),
        params![
            item.id,
            item.title,
            item.description,
            item.category,
            item.subcategory_id,
            item.subcategory_text,
            item.due_date,
            item.due_time,
            item.estimated_duration,
            item.priority,
            item.status,
            item.repeat_settings,
            item.color,
            item.notes,
            vec_to_text(&item.tags),
            vec_to_text(&item.attachments),
            item.google_calendar_id,
            item.google_task_id,
            item.last_synced_at_calendar,
            item.last_synced_at_tasks,
            item.assignment_type,
            item.points_earned,
            item.points_possible,
            item.created_at,
            item.updated_at,
            item.deleted_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(item)
}

#[tauri::command]
pub fn update_item(state: State<DbState>, mut item: Item) -> Result<Item, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    item.updated_at = now();
    conn.execute(
        "UPDATE item SET title=?2, description=?3, category=?4, subcategory_id=?5, \
         subcategory_text=?6, due_date=?7, due_time=?8, estimated_duration=?9, priority=?10, \
         status=?11, repeat_settings=?12, color=?13, notes=?14, tags=?15, attachments=?16, \
         google_calendar_id=?17, google_task_id=?18, last_synced_at_calendar=?19, last_synced_at_tasks=?20, \
         assignment_type=?21, points_earned=?22, points_possible=?23, updated_at=?24, deleted_at=?25 WHERE id=?1",
        params![
            item.id,
            item.title,
            item.description,
            item.category,
            item.subcategory_id,
            item.subcategory_text,
            item.due_date,
            item.due_time,
            item.estimated_duration,
            item.priority,
            item.status,
            item.repeat_settings,
            item.color,
            item.notes,
            vec_to_text(&item.tags),
            vec_to_text(&item.attachments),
            item.google_calendar_id,
            item.google_task_id,
            item.last_synced_at_calendar,
            item.last_synced_at_tasks,
            item.assignment_type,
            item.points_earned,
            item.points_possible,
            item.updated_at,
            item.deleted_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(item)
}

#[tauri::command]
pub fn soft_delete_item(
    state: State<DbState>,
    trigger: State<crate::google::sync::SyncTrigger>,
    id: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let timestamp = now();
    conn.execute(
        "UPDATE item SET deleted_at=?2, updated_at=?2 WHERE id=?1",
        params![id, timestamp],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    drop(conn);
    // Wake the background sync loop so the linked Calendar event / Task is
    // deleted on Google's side within seconds instead of waiting out the
    // rest of the sync interval (see google::sync::spawn).
    trigger.notify();
    Ok(())
}

#[tauri::command]
pub fn list_items(state: State<DbState>) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {ITEM_COLUMNS} FROM item WHERE deleted_at IS NULL ORDER BY created_at DESC"
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_item).map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

fn row_to_inbox_item(row: &Row) -> rusqlite::Result<InboxItem> {
    Ok(InboxItem {
        id: row.get("id")?,
        title: row.get("title")?,
        notes: row.get("notes")?,
        created_at: row.get("created_at")?,
    })
}

#[tauri::command]
pub fn create_inbox_item(
    state: State<DbState>,
    input: InboxItemInput,
) -> Result<InboxItem, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let inbox_item = InboxItem {
        id: Uuid::new_v4().to_string(),
        title: input.title,
        notes: input.notes,
        created_at: now(),
    };
    conn.execute(
        "INSERT INTO inbox_item (id, title, notes, created_at) VALUES (?1,?2,?3,?4)",
        params![
            inbox_item.id,
            inbox_item.title,
            inbox_item.notes,
            inbox_item.created_at
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(inbox_item)
}

#[tauri::command]
pub fn list_inbox_items(state: State<DbState>) -> Result<Vec<InboxItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, notes, created_at FROM inbox_item ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_inbox_item)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_inbox_item(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM inbox_item WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(())
}

fn row_to_quick_note(row: &Row) -> rusqlite::Result<QuickNote> {
    Ok(QuickNote {
        id: row.get("id")?,
        body: row.get("body")?,
        created_at: row.get("created_at")?,
    })
}

#[tauri::command]
pub fn create_quick_note(
    state: State<DbState>,
    input: QuickNoteInput,
) -> Result<QuickNote, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let quick_note = QuickNote {
        id: Uuid::new_v4().to_string(),
        body: input.body,
        created_at: now(),
    };
    conn.execute(
        "INSERT INTO quick_note (id, body, created_at) VALUES (?1,?2,?3)",
        params![quick_note.id, quick_note.body, quick_note.created_at],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(quick_note)
}

#[tauri::command]
pub fn list_quick_notes(state: State<DbState>) -> Result<Vec<QuickNote>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, body, created_at FROM quick_note ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_quick_note)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_quick_note(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM quick_note WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(())
}

fn row_to_note(row: &Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        context_id: row.get("context_id")?,
        item_id: row.get("item_id")?,
        body: row.get("body")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub fn create_note(state: State<DbState>, input: NoteInput) -> Result<Note, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let timestamp = now();
    let note = Note {
        id: Uuid::new_v4().to_string(),
        context_id: input.context_id,
        item_id: input.item_id,
        body: input.body,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    conn.execute(
        "INSERT INTO note (id, context_id, item_id, body, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6)",
        params![
            note.id,
            note.context_id,
            note.item_id,
            note.body,
            note.created_at,
            note.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(note)
}

#[tauri::command]
pub fn list_notes_for_context(
    state: State<DbState>,
    context_id: String,
) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, context_id, item_id, body, created_at, updated_at FROM note \
             WHERE context_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![context_id], row_to_note)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM note WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(())
}

fn row_to_personal_record(row: &Row) -> rusqlite::Result<PersonalRecord> {
    Ok(PersonalRecord {
        id: row.get("id")?,
        program_id: row.get("program_id")?,
        exercise_name: row.get("exercise_name")?,
        value: row.get("value")?,
        unit: row.get("unit")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub fn create_personal_record(
    state: State<DbState>,
    input: PersonalRecordInput,
) -> Result<PersonalRecord, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let timestamp = now();
    let record = PersonalRecord {
        id: Uuid::new_v4().to_string(),
        program_id: input.program_id,
        exercise_name: input.exercise_name,
        value: input.value,
        unit: input.unit,
        created_at: timestamp.clone(),
        updated_at: timestamp,
    };
    conn.execute(
        "INSERT INTO personal_record (id, program_id, exercise_name, value, unit, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            record.id,
            record.program_id,
            record.exercise_name,
            record.value,
            record.unit,
            record.created_at,
            record.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(record)
}

#[tauri::command]
pub fn update_personal_record(
    state: State<DbState>,
    mut record: PersonalRecord,
) -> Result<PersonalRecord, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    record.updated_at = now();
    conn.execute(
        "UPDATE personal_record SET program_id=?2, exercise_name=?3, value=?4, unit=?5, updated_at=?6 \
         WHERE id=?1",
        params![
            record.id,
            record.program_id,
            record.exercise_name,
            record.value,
            record.unit,
            record.updated_at
        ],
    )
    .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(record)
}

#[tauri::command]
pub fn list_personal_records(state: State<DbState>) -> Result<Vec<PersonalRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, program_id, exercise_name, value, unit, created_at, updated_at \
             FROM personal_record ORDER BY exercise_name ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_to_personal_record)
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_personal_record(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM personal_record WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    touch_activity(&conn);
    Ok(())
}

#[tauri::command]
pub fn get_preference(state: State<DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT value FROM preference WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_preference(state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO preference (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_preferences(state: State<DbState>) -> Result<Vec<(String, String)>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM preference")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?;
    rows.collect::<rusqlite::Result<Vec<_>>>()
        .map_err(|e| e.to_string())
}
