import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { CloudRain, Droplets, Thermometer, Wind } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/context";

import type { LiveSnapshot } from "../buffer";

const WIDTH = 280;
const HEIGHT = 56;
const PAD = 4;
const MS_TO_KMH = 3.6;

/**
 * Weather now (air, track, humidity, wind, rain) and the track temperature lap by lap,
 * with laps run in the rain marked under the line.
 */
export function WeatherStrip({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, f } = useI18n();
  const now = snapshot.weather;
  const points = snapshot.weather_history.filter(
    (p): p is typeof p & { lap: number; track_c: number } => p.lap != null && p.track_c != null,
  );
  if (!now && points.length === 0) return null;
  const first = points[0];
  const last = points.at(-1);
  const temps = points.map((p) => p.track_c);
  const x = scaleLinear({
    domain: [first?.lap ?? 0, Math.max(last?.lap ?? 1, (first?.lap ?? 0) + 1)],
    range: [PAD, WIDTH - PAD],
  });
  const y = scaleLinear({
    domain: [Math.min(...temps) - 1, Math.max(...temps) + 1],
    range: [HEIGHT - PAD * 3, PAD],
  });
  const celsius = (value: number | null | undefined) =>
    value == null ? "—" : t("forecast.celsius", { c: f.number(value, 1) });
  return (
    <section
      aria-labelledby="live-weather"
      className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-5"
    >
      <h2 id="live-weather" className="text-lg font-bold">
        {t("live.weather.title")}
      </h2>
      {now && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
          <Figure icon={<Thermometer />} label={t("live.weather.air")} value={celsius(now.air_c)} />
          <Figure
            icon={<Thermometer />}
            label={t("live.weather.track")}
            value={celsius(now.track_c)}
          />
          <Figure
            icon={<Droplets />}
            label={t("live.weather.humidity")}
            value={now.humidity_pct == null ? "—" : `${String(Math.round(now.humidity_pct))} %`}
          />
          <Figure
            icon={<Wind />}
            label={t("forecast.wind")}
            value={
              now.wind_ms == null
                ? "—"
                : t("forecast.kmh", { n: Math.round(now.wind_ms * MS_TO_KMH) })
            }
          />
        </dl>
      )}
      {now?.rain && (
        <p className="flex items-center gap-2 font-bold text-t-blue">
          <CloudRain aria-hidden="true" className="size-4" />
          {t("live.weather.raining")}
        </p>
      )}
      {points.length > 1 && first && last && (
        <figure className="flex flex-col gap-1">
          <svg
            viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
            className="w-full"
            aria-hidden="true"
          >
            {points
              .filter((p) => p.rain)
              .map((p) => (
                <rect
                  key={p.lap}
                  x={x(p.lap) - 2}
                  y={HEIGHT - PAD * 2}
                  width={4}
                  height={PAD * 2}
                  fill="var(--color-t-blue)"
                />
              ))}
            <LinePath
              data={points}
              x={(p) => x(p.lap)}
              y={(p) => y(p.track_c)}
              stroke="var(--color-caution)"
              strokeWidth={2}
            />
          </svg>
          <figcaption className="text-xs text-muted">
            {t("live.weather.trend", {
              from: f.number(first.track_c, 1),
              fromLap: first.lap,
              to: f.number(last.track_c, 1),
              toLap: last.lap,
            })}
            {points.some((p) => p.rain) && ` ${t("live.weather.rainLaps")}`}
          </figcaption>
        </figure>
      )}
    </section>
  );
}

function Figure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted [&>svg]:size-3.5">
        <span aria-hidden="true" className="contents">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="num font-bold">{value}</dd>
    </div>
  );
}
