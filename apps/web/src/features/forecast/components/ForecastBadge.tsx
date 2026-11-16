import type { Schema } from "@stintline/api-types";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
} from "lucide-react";

import { useI18n } from "@/lib/i18n/context";

import { RAIN_WARNING_PCT, type WeatherKind, weatherKind } from "../weather";

type Forecast = Schema<"SessionForecast">;

const ICONS = {
  clear: Sun,
  cloudy: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
} satisfies Record<WeatherKind, unknown>;

export function WeatherIcon({
  code,
  className = "size-4",
}: {
  code: number | null | undefined;
  className?: string;
}) {
  const kind = weatherKind(code);
  if (!kind) return null;
  const Icon = ICONS[kind];
  return <Icon aria-hidden="true" className={className} />;
}

/** Sky, temperature and chance of rain of one session, in a line. */
export function ForecastBadge({
  forecast,
  className = "",
  inverse = false,
}: {
  forecast: Forecast;
  className?: string;
  /** On a race-red surface: no muted or coloured text. */
  inverse?: boolean;
}) {
  const { t } = useI18n();
  const kind = weatherKind(forecast.weather_code);
  const rain = forecast.rain_probability_pct;
  const wet = rain != null && rain >= RAIN_WARNING_PCT;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm whitespace-nowrap ${className}`}
      title={t("forecast.source")}
    >
      <WeatherIcon code={forecast.weather_code} />
      {kind && <span className="sr-only">{t(`weather.${kind}`)}</span>}
      {forecast.air_c != null && (
        <span className="num">{t("forecast.temp", { c: Math.round(forecast.air_c) })}</span>
      )}
      {rain != null && (
        <span
          className={`num inline-flex items-center gap-0.5 ${wet ? "font-bold" : ""} ${inverse ? "" : wet ? "text-t-blue" : "text-muted"}`}
        >
          <Droplets aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t("forecast.rainChance")} </span>
          {Math.round(rain)} %
        </span>
      )}
    </span>
  );
}

/** The credit Open-Meteo's licence (CC BY 4.0) asks for wherever its data shows. */
export function ForecastCredit() {
  const { t } = useI18n();
  return (
    <p className="text-xs text-muted">
      {t("forecast.creditBefore")}{" "}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-ink"
      >
        Open-Meteo
      </a>{" "}
      (CC BY 4.0)
    </p>
  );
}
