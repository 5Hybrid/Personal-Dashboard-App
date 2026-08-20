import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "@/components/search/GlobalSearch";

export function AppLayout() {
  return (
    <div className="flex h-screen text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <GlobalSearch />
    </div>
  );
}
