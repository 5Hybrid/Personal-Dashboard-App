const SIZE = 64;
const STROKE = 7;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({
  label,
  completed,
  total,
  stroke = "#2a78d6",
}: {
  label: string;
  completed: number;
  total: number;
  stroke?: string;
}) {
  const pct = total > 0 ? completed / total : 0;
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <div
      className="flex flex-col items-center gap-1"
      title={`${label}: ${completed}/${total} completed`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[13px] font-semibold"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {total > 0 ? `${Math.round(pct * 100)}%` : "—"}
        </text>
      </svg>
      <span className="max-w-20 truncate text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
