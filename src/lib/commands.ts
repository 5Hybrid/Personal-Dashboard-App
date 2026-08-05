import { invoke } from "@tauri-apps/api/core";
import type {
  Context,
  ContextInput,
  GoogleCalendarEvent,
  GoogleCalendarListEntry,
  GoogleTask,
  InboxItem,
  InboxItemInput,
  Item,
  ItemInput,
  Note,
  NoteInput,
  PersonalRecord,
  PersonalRecordInput,
  QuickNote,
  QuickNoteInput,
  SyncConflict,
} from "@/types";

export const commands = {
  createItem: (input: ItemInput) => invoke<Item>("create_item", { input }),
  updateItem: (item: Item) => invoke<Item>("update_item", { item }),
  softDeleteItem: (id: string) => invoke<void>("soft_delete_item", { id }),
  listItems: () => invoke<Item[]>("list_items"),

  createContext: (input: ContextInput) => invoke<Context>("create_context", { input }),
  updateContext: (context: Context) => invoke<Context>("update_context", { context }),
  listContexts: () => invoke<Context[]>("list_contexts"),

  createInboxItem: (input: InboxItemInput) => invoke<InboxItem>("create_inbox_item", { input }),
  listInboxItems: () => invoke<InboxItem[]>("list_inbox_items"),
  deleteInboxItem: (id: string) => invoke<void>("delete_inbox_item", { id }),

  createQuickNote: (input: QuickNoteInput) => invoke<QuickNote>("create_quick_note", { input }),
  listQuickNotes: () => invoke<QuickNote[]>("list_quick_notes"),
  deleteQuickNote: (id: string) => invoke<void>("delete_quick_note", { id }),

  createNote: (input: NoteInput) => invoke<Note>("create_note", { input }),
  listNotesForContext: (contextId: string) =>
    invoke<Note[]>("list_notes_for_context", { contextId }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),

  createPersonalRecord: (input: PersonalRecordInput) =>
    invoke<PersonalRecord>("create_personal_record", { input }),
  updatePersonalRecord: (record: PersonalRecord) =>
    invoke<PersonalRecord>("update_personal_record", { record }),
  listPersonalRecords: () => invoke<PersonalRecord[]>("list_personal_records"),
  deletePersonalRecord: (id: string) => invoke<void>("delete_personal_record", { id }),

  getPreference: (key: string) => invoke<string | null>("get_preference", { key }),
  setPreference: (key: string, value: string) => invoke<void>("set_preference", { key, value }),
  listPreferences: () => invoke<[string, string][]>("list_preferences"),

  isGoogleConnected: () => invoke<boolean>("is_google_connected"),
  connectGoogle: () => invoke<void>("connect_google"),
  disconnectGoogle: () => invoke<void>("disconnect_google"),
  syncNow: () => invoke<void>("sync_now"),
  listSyncConflicts: () => invoke<SyncConflict[]>("list_sync_conflicts"),
  resolveConflict: (id: string, resolution: "mine" | "google" | "dismiss") =>
    invoke<void>("resolve_conflict", { id, resolution }),
  listUpcomingCalendarEvents: () => invoke<GoogleCalendarEvent[]>("list_upcoming_calendar_events"),
  listUpcomingGoogleTasks: () => invoke<GoogleTask[]>("list_upcoming_google_tasks"),
  listCalendarEventsInRange: (calendarId: string, timeMin: string, timeMax: string) =>
    invoke<GoogleCalendarEvent[]>("list_calendar_events_in_range", { calendarId, timeMin, timeMax }),
  listCalendars: () => invoke<GoogleCalendarListEntry[]>("list_calendars"),

  backupNow: () => invoke<void>("backup_now"),

  isAutostartEnabled: () => invoke<boolean>("is_autostart_enabled"),
  enableAutostart: () => invoke<void>("enable_autostart"),
  disableAutostart: () => invoke<void>("disable_autostart"),

  notifyNow: (title: string, body: string) => invoke<void>("notify_now", { title, body }),

  openAppWindow: (id: string, url: string, title: string) =>
    invoke<void>("open_app_window", { id, url, title }),
};
