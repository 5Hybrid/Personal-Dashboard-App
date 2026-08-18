import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QueryBoundary } from "@/components/QueryBoundary";
import { useWeather } from "@/hooks/useWeather";
import { weatherCodeInfo } from "@/lib/weather";

// Rendered without its own Card wrapper — see TodaysScheduleCard for why.
export function WeatherCard() {
  const weatherQuery = useWeather();

  return (
    <>
      <CardHeader className="rounded-t-none border-t border-border pt-(--card-spacing)">
        <CardTitle>Weather</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          isLoading={weatherQuery.isLoading}
          isError={weatherQuery.isError}
          error={weatherQuery.error}
          onRetry={() => weatherQuery.refetch()}
        >
          {weatherQuery.data && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {(() => {
                  const { icon: Icon } = weatherCodeInfo(weatherQuery.data.currentCode);
                  return <Icon className="size-12 text-primary" />;
                })()}
                <div>
                  <p className="text-4xl font-semibold tabular-nums">
                    {Math.round(weatherQuery.data.currentTemp)}°
                  </p>
                  <p className="text-xs text-muted-foreground">{weatherQuery.data.locationLabel}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {weatherCodeInfo(weatherQuery.data.currentCode).label} · H:
                {Math.round(weatherQuery.data.todayHigh)}° L:{Math.round(weatherQuery.data.todayLow)}°
              </p>
              <div className="flex justify-between border-t pt-2">
                {weatherQuery.data.upcoming.map((day) => {
                  const { icon: DayIcon } = weatherCodeInfo(day.code);
                  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: "short",
                  });
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-0.5">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <DayIcon className="size-4 text-muted-foreground" />
                      <span className="text-xs font-medium tabular-nums">{Math.round(day.high)}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </QueryBoundary>
      </CardContent>
    </>
  );
}
