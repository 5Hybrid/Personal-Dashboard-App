import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateGrade } from "@/lib/gradeCalculation";
import type { Context, Item } from "@/types";

export function GradesTab({ context, items }: { context: Context; items: Item[] }) {
  const grade = calculateGrade(items, context);
  const graded = items.filter((i) => i.points_earned != null);

  const chartData = grade.categoryBreakdown.map((c) => ({
    category: c.category,
    percent: Math.round(c.percent * 10) / 10,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-medium">Grade distribution by category</h3>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No graded assignments yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="percent" fill="var(--color-chart-1, #8884d8)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium">Per-assignment points</h3>
        {graded.length === 0 ? (
          <p className="text-sm text-muted-foreground">No graded assignments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="border-b px-2 py-1">Assignment</th>
                <th className="border-b px-2 py-1">Type</th>
                <th className="border-b px-2 py-1">Points Earned</th>
                <th className="border-b px-2 py-1">Points Possible</th>
                <th className="border-b px-2 py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {graded.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-2 py-1">{item.title}</td>
                  <td className="px-2 py-1">{item.assignment_type ?? "—"}</td>
                  <td className="px-2 py-1">{item.points_earned}</td>
                  <td className="px-2 py-1">{item.points_possible ?? "—"}</td>
                  <td className="px-2 py-1">
                    {item.points_possible
                      ? `${((item.points_earned! / item.points_possible) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {grade.currentGrade != null && (
        <p className="text-sm font-medium">
          Current grade: {grade.currentGrade.toFixed(2)}% ({grade.letter})
        </p>
      )}
    </div>
  );
}
