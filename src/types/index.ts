export type ContextType = "Class" | "Project" | "Program";
export type ContextStatus = "Active" | "Archived";

export interface Context {
  id: string;
  type: ContextType;
  name: string;
  color: string | null;
  status: ContextStatus;
  term: string | null;
  schedule: string | null;
  owner: string | null;
  grade_scale: Record<string, number> | null;
  grade_cutoffs: Record<string, number> | null;
}

export interface ContextInput {
  type: ContextType;
  name: string;
  color?: string | null;
  status?: ContextStatus;
  term?: string | null;
  schedule?: string | null;
  owner?: string | null;
  grade_scale?: Record<string, number> | null;
  grade_cutoffs?: Record<string, number> | null;
}

export type Category =
  | "School"
  | "Work"
  | "Gym"
  | "Personal"
  | "Finance"
  | "Projects"
  | "Relationships"
  | "Health"
  | "Travel"
  | "Custom";

export type Priority = "Low" | "Medium" | "High";
export type ItemStatus = "Not Started" | "In Progress" | "Completed";

export interface Item {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  subcategory_id: string | null;
  subcategory_text: string | null;
  due_date: string | null;
  due_time: string | null;
  estimated_duration: number | null;
  priority: Priority;
  status: ItemStatus;
  repeat_settings: string | null;
  color: string | null;
  notes: string | null;
  tags: string[] | null;
  attachments: string[] | null;

  google_calendar_id: string | null;
  google_task_id: string | null;
  last_synced_at_calendar: string | null;
  last_synced_at_tasks: string | null;

  assignment_type: string | null;
  points_earned: number | null;
  points_possible: number | null;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InboxItem {
  id: string;
  title: string;
  notes: string | null;
  created_at: string;
}

export interface InboxItemInput {
  title: string;
  notes?: string | null;
}

export interface QuickNote {
  id: string;
  body: string;
  created_at: string;
}

export interface QuickNoteInput {
  body: string;
}

export interface Note {
  id: string;
  context_id: string;
  item_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface NoteInput {
  context_id: string;
  item_id?: string | null;
  body: string;
}

export interface PersonalRecord {
  id: string;
  program_id: string | null;
  exercise_name: string;
  value: number;
  unit: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonalRecordInput {
  program_id?: string | null;
  exercise_name: string;
  value: number;
  unit?: string | null;
}

export interface GoogleEventDateTime {
  date: string | null;
  dateTime: string | null;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string | null;
  updated: string | null;
  status: string | null;
  start: GoogleEventDateTime | null;
  end: GoogleEventDateTime | null;
}

export interface GoogleCalendarListEntry {
  id: string;
  summary: string | null;
  background_color: string | null;
  primary: boolean | null;
}

export interface GoogleTask {
  id: string;
  title: string | null;
  updated: string | null;
  status: string | null;
  due: string | null;
  deleted: boolean | null;
}

export interface SyncConflict {
  id: string;
  item_id: string;
  source: "calendar" | "tasks";
  local_snapshot: { title?: string; due_date?: string | null; due_time?: string | null; status?: string };
  remote_snapshot: { title?: string; due_date?: string | null; status?: string; source?: string };
  created_at: string;
}

export interface ItemInput {
  title: string;
  description?: string | null;
  category: Category;
  subcategory_id?: string | null;
  subcategory_text?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  estimated_duration?: number | null;
  priority?: Priority;
  status?: ItemStatus;
  repeat_settings?: string | null;
  color?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  attachments?: string[] | null;
  assignment_type?: string | null;
  points_earned?: number | null;
  points_possible?: number | null;
}
