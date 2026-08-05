import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Dumbbell,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Monitor,
  Moon,
  Settings,
  Sun,
  User,
  Zap,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import type { Theme } from "@/store/themeStore";

const THEME_CYCLE: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "futuristic",
  futuristic: "light",
};
const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor, futuristic: Zap };
const THEME_LABEL: Record<Theme, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Matching system theme",
  futuristic: "Futuristic theme",
};

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox, end: false },
  { to: "/master-list", label: "Master List", icon: ListTodo, end: false },
  { to: "/school", label: "School", icon: GraduationCap, end: false },
  { to: "/work", label: "Work", icon: Briefcase, end: false },
  { to: "/gym", label: "Gym", icon: Dumbbell, end: false },
  { to: "/personal", label: "Personal", icon: User, end: false },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, end: false },
  { to: "/statistics", label: "Statistics", icon: BarChart3, end: false },
  { to: "/settings", label: "Settings", icon: Settings, end: false },
] as const;

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const ThemeIcon = THEME_ICON[theme];

  return (
    <aside className="w-56 shrink-0 border-r border-[color:var(--glass-border)] bg-sidebar/55 text-sidebar-foreground shadow-[4px_0_32px_-12px_var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="font-heading text-lg font-semibold">Life OS</span>
        <button
          type="button"
          onClick={() => setTheme(THEME_CYCLE[theme])}
          title={`${THEME_LABEL[theme]} — click to cycle`}
          className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:backdrop-blur-sm"
        >
          <ThemeIcon className="size-4" />
        </button>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground shadow-sm ring-1 ring-[color:var(--glass-border)] backdrop-blur-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
