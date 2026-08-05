// Shared between Settings.tsx (the picker UI) and Calendar.tsx (what actually
// gets queried) so the two never drift on how the preference is encoded.
export const SELECTED_CALENDARS_PREF_KEY = "google_selected_calendar_ids";

export function parseSelectedCalendarIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
