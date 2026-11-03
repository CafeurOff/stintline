import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { Dialog } from "@/components/ui/Dialog";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { countryName } from "@/lib/i18n/geo";
import type { Locale } from "@/lib/i18n/locale";
import { useNow } from "@/lib/useNow";

import { type EventItem, type SeasonEvents, timedSessions, useTimedEvents } from "./useRaces";

interface RacePickerProps {
  sessionId: number;
  /** Sub-view kept when switching race (`""` circuit, `"/tyres"`). */
  view: string;
}

function matches(event: EventItem, query: string, locale: Locale): boolean {
  const haystack = [
    event.name,
    eventName(event.name, locale),
    event.circuit.name,
    event.circuit.locality,
    event.circuit.country,
    countryName(event.circuit.country, locale),
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const needle = query
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

function findSession(seasons: readonly SeasonEvents[], sessionId: number) {
  for (const season of seasons) {
    for (const event of season.events) {
      const session = event.sessions.find((s) => s.id === sessionId);
      if (session) return { event, kind: session.kind };
    }
  }
  return null;
}

/**
 * Race picker: a button naming the current race opens a dialog with the calendar of each
 * season with timing, searchable by Grand Prix, country or circuit.
 */
export function RacePicker({ sessionId, view }: RacePickerProps) {
  const { t, locale } = useI18n();
  const { seasons, isPending, isError, error, refetch } = useTimedEvents();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = findSession(seasons, sessionId);
  const [year, setYear] = useState<number | null>(null);
  const shownYear = year ?? current?.event.season ?? seasons[0]?.year ?? null;

  const searching = query.trim().length > 0;
  const shown: EventItem[] = searching
    ? seasons.flatMap((s) => s.events.filter((e) => matches(e, query, locale)))
    : (seasons.find((s) => s.year === shownYear)?.events ?? []);

  const close = () => {
    setOpen(false);
    setQuery("");
    setYear(null);
  };

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
        className="group flex min-w-0 items-center gap-2 rounded-lg border border-line-strong px-3 py-1.5 text-left hover:border-ink"
      >
        <span className="min-w-0">
          <span className="block text-xs text-muted">{t("picker.open")}</span>
          <span className="block truncate font-bold">
            {current
              ? `${eventName(current.event.name, locale)} ${current.event.season}${
                  current.kind === "SPRINT" ? ` · ${t("picker.sprint")}` : ""
                }`
              : t("common.loading")}
          </span>
        </span>
        <span aria-hidden="true" className="text-muted group-hover:text-ink">
          ▾
        </span>
      </button>

      <Dialog open={open} onClose={close} title={t("picker.title")}>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="sr-only">{t("picker.search")}</span>
            <input
              type="search"
              value={query}
              placeholder={t("picker.search")}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              className="w-full rounded-lg border border-line-strong bg-bg px-3 py-2.5 text-ink placeholder:text-muted"
            />
          </label>
          {!searching && seasons.length > 1 && shownYear !== null && (
            <SegmentedControl
              legend={t("picker.season")}
              hideLegend
              options={seasons.map((s) => ({ value: String(s.year), label: String(s.year) }))}
              value={String(shownYear)}
              onChange={(value) => {
                setYear(Number(value));
              }}
            />
          )}
          {isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : isPending ? (
            <Skeleton className="h-64" />
          ) : shown.length === 0 ? (
            <EmptyState title={t("picker.empty", { query: query.trim() })} />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {shown.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  sessionId={sessionId}
                  view={view}
                  showYear={searching}
                  onPick={close}
                />
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}

interface EventCardProps {
  event: EventItem;
  sessionId: number;
  view: string;
  showYear: boolean;
  onPick: () => void;
}

function EventCard({ event, sessionId, view, showYear, onPick }: EventCardProps) {
  const { t, f, locale } = useI18n();
  const now = useNow();
  const ref = useRef<HTMLLIElement>(null);
  const sessions = timedSessions(event);
  const race = sessions.find((s) => s.kind === "R");
  const sprint = sessions.find((s) => s.kind === "SPRINT");
  const isCurrent = event.sessions.some((s) => s.id === sessionId);
  const upcoming = new Date(`${event.race_date}T23:59:59Z`).getTime() > now;
  const name = eventName(event.name, locale);
  const winner = event.winner;

  useEffect(() => {
    if (isCurrent) ref.current?.scrollIntoView({ block: "center" });
  }, [isCurrent]);

  const body = (
    <>
      <span className="flex items-baseline justify-between gap-2 text-sm text-muted">
        <span className="tabular">{t("picker.round", { round: event.round })}</span>
        <span>{f.date(event.race_date)}</span>
      </span>
      <span className="block font-bold text-ink">
        {name}
        {showYear ? ` ${event.season}` : ""}
      </span>
      <span className="block truncate text-sm text-muted">
        {event.circuit.locality} · {countryName(event.circuit.country, locale)}
      </span>
    </>
  );

  if (!race) {
    return (
      <li ref={ref} className="rounded-xl border border-dashed border-line p-3 opacity-70">
        {body}
        <span className="mt-2 block text-sm text-muted">
          {upcoming ? t("picker.upcoming") : t("picker.noData")}
        </span>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className={`relative rounded-xl border p-3 transition hover:border-ink ${
        isCurrent ? "border-mark bg-raised" : "border-line"
      }`}
    >
      <Link
        to={`/sessions/${race.id}${view}`}
        onClick={onPick}
        aria-current={race.id === sessionId ? "page" : undefined}
        className="block after:absolute after:inset-0 after:rounded-xl"
      >
        {body}
      </Link>
      <span className="mt-2 flex items-center justify-between gap-2">
        {winner ? (
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <DriverAvatar
              label={winner.driver.code ?? winner.car_number}
              name={`${winner.driver.given_name} ${winner.driver.family_name}`}
              colour={winner.team_colour}
              imageUrl={winner.driver.portrait_url}
              size="xs"
              decorative
            />
            <span className="truncate">
              {t("picker.winner", { name: winner.driver.family_name })}
            </span>
          </span>
        ) : (
          <span />
        )}
        {sprint && (
          <Link
            to={`/sessions/${sprint.id}${view}`}
            onClick={onPick}
            aria-current={sprint.id === sessionId ? "page" : undefined}
            aria-label={t("picker.sprintOf", { name })}
            className={`relative z-10 rounded-md border px-2 py-0.5 text-sm font-semibold hover:border-ink ${
              sprint.id === sessionId ? "border-mark text-ink" : "border-line-strong text-muted"
            }`}
          >
            {t("picker.sprint")}
          </Link>
        )}
      </span>
    </li>
  );
}
