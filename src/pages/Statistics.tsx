import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryBoundary } from "@/components/QueryBoundary";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { useContexts } from "@/hooks/useContexts";
import { useItems } from "@/hooks/useItems";
import { useTheme } from "@/hooks/useTheme";
import {
  completedCount,
  completionRate,
  completionsInLastNDays,
  dailyCompletionTrend,
  gymWorkoutStreak,
  hoursStudied,
  missedDeadlines,
} from "@/lib/statistics";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </CardContent>
    </Card>
  );
}

export default function Statistics() {
  const itemsQuery = useItems();
  const contextsQuery = useContexts();
  const { theme } = useTheme();

  const allItems = itemsQuery.data ?? [];
  const classes = (contextsQuery.data ?? []).filter((c) => c.type === "Class" && c.status === "Active");
  const trend = dailyCompletionTrend(allItems, 30);
  // --chart-1 is a light neutral gray in the light/dark themes (part of a
  // print-friendly grayscale set) — too washed out for a single solid bar,
  // so this chart keeps its own fixed blue there. Futuristic's --chart-1 is
  // a vivid neon cyan tuned to be used exactly this way, so it opts in.
  const barFill = theme === "futuristic" ? "var(--chart-1)" : "#2a78d6";

  return (
    <div className="space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Statistics</h1>

      <QueryBoundary
        isLoading={itemsQuery.isLoading || contextsQuery.isLoading}
        isError={itemsQuery.isError || contextsQuery.isError}
        error={itemsQuery.error ?? contextsQuery.error}
        onRetry={() => {
          itemsQuery.refetch();
          contextsQuery.refetch();
        }}
      >
      <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Assignments/Tasks completed" value={String(completedCount(allItems))} />
        <StatTile label="Completion rate" value={`${Math.round(completionRate(allItems) * 100)}%`} />
        <StatTile label="Missed deadlines" value={String(missedDeadlines(allItems))} />
        <StatTile label="Hours studied" value={hoursStudied(allItems).toFixed(1)} />
        <StatTile label="Workout streak" value={`${gymWorkoutStreak(allItems)} day(s)`} />
        <StatTile label="Completions this week" value={String(completionsInLastNDays(allItems, 7))} />
        <StatTile label="Completions this month" value={String(completionsInLastNDays(allItems, 30))} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productivity — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={false} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={barFill} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>School progress by Class</CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active classes yet.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {classes.map((c) => {
                const classItems = allItems.filter((i) => i.subcategory_id === c.id);
                const completed = classItems.filter((i) => i.status === "Completed").length;
                return (
                  <ProgressRing
                    key={c.id}
                    label={c.name}
                    completed={completed}
                    total={classItems.length}
                    stroke={barFill}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
      </QueryBoundary>
    </div>
  );
}
