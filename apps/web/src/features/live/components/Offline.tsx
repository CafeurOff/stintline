import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";
import type { CSSProperties } from "react";

import { AmbientTrack } from "@/components/layout/AmbientTrack";
import { Countdown } from "@/components/layout/Countdown";
import { pillPrimary } from "@/components/layout/Glass";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { Trails } from "@/components/layout/Trails";
import { CircuitMark } from "@/components/racing/CircuitMark";
import { useForecasts } from "@/features/forecast/api";
import { ForecastBadge, ForecastCredit } from "@/features/forecast/components/ForecastBadge";
import { circuitAccent } from "@/lib/accent";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { useEvent, useHome } from "@/lib/queries";
import { sessionLabel } from "@/lib/sessions";
import { useClock } from "@/lib/useClock";

const SESSION_HOURS = 2;

const HOUR_MS = 3_600_000;

/** No live data: what comes next, the weekend in the visitor's time, and replays meanwhile. */
export function Offline({ next }: { next: Schema<"LiveStatus">["next_session"] }) {
  const { t, locale } = useI18n();
  const now = useClock(30_000);
  const event = useEvent(next?.event_id ?? 0, next !== null).data;
  const last = useHome().data?.last_race;
  const forecasts = useForecasts(next?.event_id).data ?? [];
  const tag = locale === "fr" ? "fr-FR" : "en-GB";
  const when = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const accent = event ? circuitAccent(event.circuit.ref) : "var(--color-mark)";
  const sessions = (event?.sessions ?? []).filter((s) => s.scheduled_start);
  const running = sessions.find((s) => {
    const start = new Date(s.scheduled_start ?? "").getTime();
    return now >= start && now < start + SESSION_HOURS * HOUR_MS;
  });

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby="live-title"
        className="glass glow relative overflow-hidden rounded-[24px]"
        style={{ "--glow": accent, "--glow-x": "90%", "--glow-y": "50%" } as CSSProperties}
      >
        <Trails colour={accent} />
        {event?.circuit.outline && (
          <AmbientTrack
            path={event.circuit.outline}
            colour={accent}
            className="pointer-events-none absolute top-1/2 right-6 hidden aspect-square w-[34%] max-w-md -translate-y-1/2 lg:block"
          />
        )}
        <div className="relative flex flex-col gap-6 p-6 sm:p-10 lg:max-w-[62%]">
          <p className="flex items-center gap-2 text-xs font-bold tracking-wide uppercase">
            <span className="flex items-center gap-1.5 rounded-md bg-ink/10 px-2 py-0.5">
              <span
                className={`size-2 rounded-full ${running ? "animate-pulse bg-mark" : "bg-line-strong"}`}
              />
              {t("nav.live")}
            </span>
          </p>
          <div>
            <h1 id="live-title" className="display text-3xl leading-[0.95] sm:text-6xl">
              {running ? t("live.running.title") : t("live.offline.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-lg text-muted">
              {running ? t("live.running.body") : t("live.offline.body")}
            </p>
          </div>
          {next && !running && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-mark-text uppercase">
                  {t("live.next")} · {sessionLabel(next.kind, t)}
                </p>
                <h2 className="display text-2xl">
                  <Link to={`/events/${String(next.event_id)}`} className="hover:underline">
                    {eventName(next.event_name, locale)}
                  </Link>
                </h2>
                <p className="text-muted first-letter:uppercase">
                  {when.format(new Date(next.starts_at))}
                </p>
              </div>
              <Countdown target={next.starts_at} />
            </div>
          )}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {sessions.length > 0 && event && (
          <section
            aria-labelledby="live-weekend"
            className="glass reveal flex flex-col gap-3 rounded-[20px] p-5"
          >
            <SectionTitle id="live-weekend">{eventName(event.name, locale)}</SectionTitle>
            <ul className="flex flex-col">
              {sessions.map((s) => {
                const start = new Date(s.scheduled_start ?? "").getTime();
                const done = now >= start + SESSION_HOURS * HOUR_MS;
                const isRunning = s === running;
                const sky = forecasts.find((row) => row.session_id === s.id);
                return (
                  <li
                    key={s.id}
                    className={`flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0 ${
                      done ? "text-muted" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {isRunning && <span className="size-2 animate-pulse rounded-full bg-mark" />}
                      {sessionLabel(s.kind, t)}
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="text-sm tabular-nums first-letter:uppercase">
                        {done ? t("live.done") : when.format(new Date(start))}
                      </span>
                      {!done && sky && <ForecastBadge forecast={sky} />}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">{t("home.localTime")}</p>
            {forecasts.length > 0 && <ForecastCredit />}
          </section>
        )}
        {last?.has_data && (
          <section
            aria-labelledby="live-replay"
            className="glass reveal relative flex flex-col justify-between gap-6 overflow-hidden rounded-[20px] p-5"
          >
            {last.event.circuit.outline && (
              <CircuitMark
                path={last.event.circuit.outline}
                stroke="var(--color-ink)"
                width={4}
                className="pointer-events-none absolute top-4 right-4 size-32 opacity-20"
              />
            )}
            <div className="relative">
              <p className="text-xs font-bold tracking-wide text-muted uppercase">
                {t("live.meanwhile")}
              </p>
              <h2 id="live-replay" className="display mt-1 max-w-[70%] text-2xl">
                {eventName(last.event.name, locale)} {last.event.season}
              </h2>
              <p className="mt-2 max-w-md text-muted">{t("live.replayBody")}</p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Link to={`/sessions/${String(last.session_id)}`} className={pillPrimary}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                  <path d="M7 4l13 8-13 8z" />
                </svg>
                {t("live.replayLast")}
              </Link>
              <Link
                to={`/news/${String(last.session_id)}`}
                className="glass rounded-xl px-5 py-3 font-bold"
              >
                {t("home.report")}
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
