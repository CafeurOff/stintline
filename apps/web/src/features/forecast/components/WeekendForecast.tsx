import { CloudSun } from "lucide-react";

import { Panel } from "@/components/dash/Panel";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";

import { useForecasts } from "../api";
import { weatherKind } from "../weather";

const MS_TO_KMH = 3.6;
import { ForecastCredit, WeatherIcon } from "./ForecastBadge";

/**
 * Weather of each session of a coming Grand Prix. Shows nothing until a forecast exists
 * (Open-Meteo reaches about two weeks ahead).
 */
export function WeekendForecast({ eventId }: { eventId: number }) {
  const { t, f, locale } = useI18n();
  const forecasts = useForecasts(eventId).data ?? [];
  if (forecasts.length === 0) return null;
  const when = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Panel title={t("forecast.title")} icon={<CloudSun />}>
      <div className="relative overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">{t("forecast.title")}</caption>
          <thead>
            <tr>
              <th>{t("forecast.session")}</th>
              <th>{t("forecast.sky")}</th>
              <th className="num">{t("forecast.air")}</th>
              <th className="num">{t("forecast.rainChance")}</th>
              <th className="num hidden sm:table-cell">{t("forecast.rainAmount")}</th>
              <th className="num hidden sm:table-cell">{t("forecast.wind")}</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((row) => {
              const kind = weatherKind(row.weather_code);
              return (
                <tr key={row.session_id}>
                  <td>
                    <span className="block font-semibold">{sessionLabel(row.kind, t)}</span>
                    <span className="text-xs text-muted first-letter:uppercase">
                      {when.format(new Date(row.window_start))}
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <WeatherIcon code={row.weather_code} className="size-5" />
                      {kind ? t(`weather.${kind}`) : "—"}
                    </span>
                  </td>
                  <td className="num">
                    {row.air_min_c != null && row.air_max_c != null
                      ? t("forecast.range", {
                          min: Math.round(row.air_min_c),
                          max: Math.round(row.air_max_c),
                        })
                      : "—"}
                  </td>
                  <td className="num">
                    {row.rain_probability_pct == null
                      ? "—"
                      : `${String(Math.round(row.rain_probability_pct))} %`}
                  </td>
                  <td className="num hidden sm:table-cell">
                    {row.precipitation_mm == null ? "—" : `${f.number(row.precipitation_mm, 1)} mm`}
                  </td>
                  <td className="num hidden sm:table-cell">
                    {row.wind_ms == null
                      ? "—"
                      : t("forecast.kmh", { n: Math.round(row.wind_ms * MS_TO_KMH) })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3">
        <ForecastCredit />
      </div>
    </Panel>
  );
}
