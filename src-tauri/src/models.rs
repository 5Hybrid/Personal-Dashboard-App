use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Context {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub name: String,
    pub color: Option<String>,
    pub status: String,
    pub term: Option<String>,
    pub schedule: Option<String>,
    pub owner: Option<String>,
    pub grade_scale: Option<Value>,
    pub grade_cutoffs: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContextInput {
    #[serde(rename = "type")]
    pub type_: String,
    pub name: String,
    pub color: Option<String>,
    pub status: Option<String>,
    pub term: Option<String>,
    pub schedule: Option<String>,
    pub owner: Option<String>,
    pub grade_scale: Option<Value>,
    pub grade_cutoffs: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Item {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub category: String,
    pub subcategory_id: Option<String>,
    pub subcategory_text: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub estimated_duration: Option<i64>,
    pub priority: String,
    pub status: String,
    pub repeat_settings: Option<String>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub attachments: Option<Vec<String>>,

    pub google_calendar_id: Option<String>,
    pub google_task_id: Option<String>,
    pub last_synced_at_calendar: Option<String>,
    pub last_synced_at_tasks: Option<String>,

    pub assignment_type: Option<String>,
    pub points_earned: Option<f64>,
    pub points_possible: Option<f64>,

    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InboxItem {
    pub id: String,
    pub title: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InboxItemInput {
    pub title: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickNote {
    pub id: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickNoteInput {
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub context_id: String,
    pub item_id: Option<String>,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteInput {
    pub context_id: String,
    pub item_id: Option<String>,
    pub body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalRecord {
    pub id: String,
    pub program_id: Option<String>,
    pub exercise_name: String,
    pub value: f64,
    pub unit: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PersonalRecordInput {
    pub program_id: Option<String>,
    pub exercise_name: String,
    pub value: f64,
    pub unit: Option<String>,
}

/// One Obsidian note matched by `search::search_obsidian_vault`. `path` is
/// vault-relative (forward-slash separated) so it round-trips back into
/// `search::read_obsidian_note` regardless of host OS path separators.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ObsidianNote {
    pub path: String,
    pub title: String,
    pub snippet: Option<String>,
    pub modified: Option<String>,
}

/// Result of probing a candidate vault folder from the Settings page, before
/// it's saved as the `obsidian_vault_path` preference.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ObsidianVaultStatus {
    pub valid: bool,
    pub note_count: usize,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FocusSession {
    pub id: String,
    pub intent: String,
    pub goal: Option<String>,
    pub item_id: Option<String>,
    pub category: Option<String>,
    pub planned_duration_seconds: Option<i64>,
    pub break_duration_seconds: i64,
    pub phase: String,
    pub running_since: Option<String>,
    pub accumulated_seconds: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub actual_duration_seconds: Option<i64>,
    pub session_state: String,
    pub outcome: Option<String>,
    pub reflection_note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StartFocusSessionInput {
    pub intent: String,
    pub goal: Option<String>,
    pub item_id: Option<String>,
    pub category: Option<String>,
    pub planned_duration_seconds: Option<i64>,
    pub break_duration_seconds: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemInput {
    pub title: String,
    pub description: Option<String>,
    pub category: String,
    pub subcategory_id: Option<String>,
    pub subcategory_text: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub estimated_duration: Option<i64>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub repeat_settings: Option<String>,
    pub color: Option<String>,
    pub notes: Option<String>,
    pub tags: Option<Vec<String>>,
    pub attachments: Option<Vec<String>>,
    pub assignment_type: Option<String>,
    pub points_earned: Option<f64>,
    pub points_possible: Option<f64>,
}
