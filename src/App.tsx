import { useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useThemeEffect } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import Dashboard from "@/pages/Dashboard";
import Inbox from "@/pages/Inbox";
import MasterList from "@/pages/MasterList";
import SchoolHome from "@/pages/school/SchoolHome";
import ClassWorkspace from "@/pages/school/ClassWorkspace";
import Work from "@/pages/Work";
import Gym from "@/pages/Gym";
import Personal from "@/pages/Personal";
import CalendarPage from "@/pages/Calendar";
import Statistics from "@/pages/Statistics";
import Settings from "@/pages/Settings";

function App() {
  useThemeEffect();

  // App() only mounts once per real app launch (HashRouter navigation
  // re-renders the matched Route, it doesn't remount App), so this fade+rise
  // only ever plays on boot — not on every page change.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <HashRouter>
      <div
        className={cn(
          "transition-all duration-500 ease-out",
          entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="master-list" element={<MasterList />} />
            <Route path="school" element={<SchoolHome />} />
            <Route path="school/:contextId" element={<ClassWorkspace />} />
            <Route path="work" element={<Work />} />
            <Route path="gym" element={<Gym />} />
            <Route path="personal" element={<Personal />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
