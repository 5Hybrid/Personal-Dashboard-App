import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateGrade } from "@/lib/gradeCalculation";
import type { Context, Item } from "@/types";

export function OverviewTab({ context, items }: { context: Context; items: Item[] }) {
  const grade = calculateGrade(items, context);
  const completed = items.filter((i) => i.status === "Completed").length;
  const completionPct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-medium">{context.schedule ?? "—"}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Professor</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-medium">{context.owner ?? "—"}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Current Grade</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-medium">
          {grade.currentGrade != null
            ? `${grade.currentGrade.toFixed(2)}% (${grade.letter})`
            : "No graded assignments yet"}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Completion</CardTitle>
        </CardHeader>
        <CardContent className="text-lg font-medium">
          {completionPct}% ({completed}/{items.length})
        </CardContent>
      </Card>
    </div>
  );
}
