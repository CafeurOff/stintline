import { CloudRain, Flag as FlagIcon, Sun } from "lucide-react";

import { useI18n } from "@/lib/i18n/context";

import { clockLabel, latestAt, type Timeline } from "../timeline";

/** Messages shown at once: the latest ones before the replay instant. */
const MESSAGES_SHOWN = 6;

/** Weather and race control as they stood at the replay instant. */
export function SessionConditions({ timeline, time }: { timeline: Timeline; time: number }) {
  const { t, f } = useI18n();
  const weather = latestAt(timeline.weather, time, (w) => w.at_s);
  const messages = timeline.race_control
    .filter((m) => m.at_s <= time)
    .slice(-MESSAGES_SHOWN)
    .reverse();
  const temperature = (value: number | null) => (value === null ? "—" : `${f.number(value, 1)} °C`);

  return (
    <div className="flex flex-col gap-5">
      {weather && (
        <section aria-labelledby="session-weather" className="flex flex-col gap-2">
          <h3 id="session-weather" className="text-sm font-bold">
            {t("sreplay.weather")}
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 xl:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">{t("sreplay.air")}</dt>
              <dd className="timing font-bold">{temperature(weather.air_temperature_c)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("sreplay.trackTemp")}</dt>
              <dd className="timing font-bold">{temperature(weather.track_temperature_c)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("sreplay.wind")}</dt>
              <dd className="timing font-bold">
                {weather.wind_speed_ms === null ? "—" : `${f.number(weather.wind_speed_ms, 1)} m/s`}
              </dd>
            </div>
            <div>
              <dt className="sr-only">{t("sreplay.rain")}</dt>
              <dd className="flex items-center gap-1.5 font-bold">
                {weather.rainfall ? (
                  <CloudRain aria-hidden="true" className="size-4 text-t-blue" />
                ) : (
                  <Sun aria-hidden="true" className="size-4 text-caution" />
                )}
                {weather.rainfall ? t("sreplay.rain") : t("sreplay.dry")}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section aria-labelledby="session-race-control" className="flex flex-col gap-2">
        <h3 id="session-race-control" className="flex items-center gap-2 text-sm font-bold">
          <FlagIcon aria-hidden="true" className="size-4" />
          {t("sreplay.raceControl")}
        </h3>
        {messages.length === 0 ? (
          <p className="text-sm text-muted">{t("sreplay.noMessage")}</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {messages.map((m) => (
              <li key={`${String(m.at_s)}-${m.message}`} className="flex gap-2">
                <span className="timing shrink-0 text-xs text-muted">{clockLabel(m.at_s)}</span>
                <span className="min-w-0 break-words">{m.message}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
