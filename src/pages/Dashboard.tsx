import { QueryBoundary } from "@/components/QueryBoundary";
import { Card } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ExternalAppsSection } from "@/components/externalApps/ExternalAppsSection";
import { FocusTimerCard } from "@/components/dashboard/FocusTimerCard";
import { MiniCalendarCard } from "@/components/dashboard/MiniCalendarCard";
import { MyTasksCard } from "@/components/dashboard/MyTasksCard";
import { QuickNotesCard } from "@/components/dashboard/QuickNotesCard";
import { SyncConflicts } from "@/components/dashboard/SyncConflicts";
import { TodaysScheduleCard } from "@/components/dashboard/TodaysScheduleCard";
import { UpcomingDeadlinesCard } from "@/components/dashboard/UpcomingDeadlinesCard";
import { WeatherCard } from "@/components/dashboard/WeatherCard";
import { useItems } from "@/hooks/useItems";

export default function Dashboard() {
  const itemsQuery = useItems();
  const allItems = itemsQuery.data ?? [];

  return (
    <div className="space-y-6 p-8">
      <DashboardHeader />

      <SyncConflicts />

      <QueryBoundary
        isLoading={itemsQuery.isLoading}
        isError={itemsQuery.isError}
        error={itemsQuery.error}
        onRetry={() => itemsQuery.refetch()}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <MiniCalendarCard items={allItems} />
            <Card>
              <TodaysScheduleCard items={allItems} />
              <WeatherCard />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <MyTasksCard items={allItems} />
            </div>
            <FocusTimerCard />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingDeadlinesCard items={allItems} />
            <QuickNotesCard />
          </div>

          <ExternalAppsSection />
        </div>
      </QueryBoundary>
    </div>
  );
}
