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
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  Timer,
  User,
  Zap,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import { useSearchStore } from "@/store/searchStore";
import { useSidebarStore } from "@/store/sidebarStore";
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
  { to: "/focus", label: "Focus", icon: Timer, end: false },
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
  const openSearch = useSearchStore((s) => s.open);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggle);
  const ThemeIcon = THEME_ICON[theme];

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-[color:var(--glass-border)] bg-sidebar/55 text-sidebar-foreground shadow-[4px_0_32px_-12px_var(--glass-shadow)] backdrop-blur-xl backdrop-saturate-150 flex flex-col transition-[width] duration-200",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("flex items-center py-4", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        {!collapsed && <span className="font-heading text-lg font-semibold">Life OS</span>}
        <button
          type="button"
          onClick={() => setTheme(THEME_CYCLE[theme])}
          title={`${THEME_LABEL[theme]} — click to cycle`}
          className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground hover:backdrop-blur-sm"
        >
          <ThemeIcon className="size-4" />
        </button>
      </div>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={openSearch}
          title={collapsed ? "Search — Ctrl K" : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Search</span>
              <kbd className="rounded border border-[color:var(--glass-border)] px-1 py-0.5 text-[10px] text-sidebar-foreground/50">
                Ctrl K
              </kbd>
            </>
          )}
        </button>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground shadow-sm ring-1 ring-[color:var(--glass-border)] backdrop-blur-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>
      <div className="px-2 pb-3 pt-1">
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
