import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFocusSessions } from "@/hooks/useFocusSessions";
import {
  focusedSecondsByCategory,
  formatFocusDuration,
  monthFocusedSeconds,
  todayFocusedSeconds,
  weekFocusedSeconds,
} from "@/lib/focusStatistics";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold tabular-nums">{value}</CardContent>
    </Card>
  );
}

export function FocusProgressStats() {
  const { data } = useFocusSessions();
  const sessions = data ?? [];
  const byCategory = Object.entries(focusedSecondsByCategory(sessions)).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Today" value={formatFocusDuration(todayFocusedSeconds(sessions))} />
        <StatTile label="This Week" value={formatFocusDuration(weekFocusedSeconds(sessions))} />
        <StatTile label="This Month" value={formatFocusDuration(monthFocusedSeconds(sessions))} />
      </div>

      {byCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">By area</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {byCategory.map(([category, seconds]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span>{category}</span>
                <span className="tabular-nums text-muted-foreground">{formatFocusDuration(seconds)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
