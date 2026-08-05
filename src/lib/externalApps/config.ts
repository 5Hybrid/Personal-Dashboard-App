import { Flame, type LucideIcon } from "lucide-react";

// Ordered fallback preference — first entry is what's attempted first.
// "embedded": iframe inside the Dashboard's WidgetContainer.
// "popout": a real separate Tauri desktop window (external_apps.rs::open_app_window).
// "browser": the OS default browser (@tauri-apps/plugin-opener).
export type LaunchMode = "embedded" | "popout" | "browser";

export type PreferredSize = "small" | "medium" | "large";

export interface ExternalAppConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  url: string;
  preferredSize: PreferredSize;
  launchModes: LaunchMode[];
  /** "coming-soon" entries render greyed-out with no iframe attempt — for
   * apps registered ahead of having a real URL. Not used yet, but the
   * ExternalAppsSection/WidgetContainer already branch on it so a future app
   * can ship as a placeholder before its URL exists. */
  status: "active" | "coming-soon";
}

// Adding an app to this array is the *only* code change adding-a-widget
// should ever require — see the External App Widget System plan.
export const EXTERNAL_APPS: ExternalAppConfig[] = [
  {
    id: "habit-tracker",
    name: "Habit Tracker",
    description: "Track daily habits and streaks.",
    icon: Flame,
    url: "https://habit-tracker-nine-snowy.vercel.app",
    preferredSize: "medium",
    launchModes: ["embedded", "popout", "browser"],
    status: "active",
  },
];
