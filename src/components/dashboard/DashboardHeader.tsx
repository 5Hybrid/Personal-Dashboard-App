import { useEffect, useState } from "react";
import { usePreferences } from "@/hooks/usePreferences";
import { timeOfDayGreeting } from "@/lib/greeting";
import { NOTIFICATION_DEFAULTS } from "@/lib/notificationDefaults";

export function DashboardHeader() {
  const { data: prefs } = usePreferences();
  const name = prefs?.user_name ?? NOTIFICATION_DEFAULTS.user_name;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">
          {timeOfDayGreeting(now)}, <span className="text-primary">{name}</span>{" "}
          <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Focus · Plan · Execute · Succeed</p>
      </div>
      <div className="text-right">
        <p className="text-4xl font-semibold tabular-nums">
          {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
        <p className="text-sm text-muted-foreground">
          {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}
