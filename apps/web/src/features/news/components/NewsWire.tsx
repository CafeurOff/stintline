import type { Schema } from "@stintline/api-types";
import { ExternalLink, Newspaper, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { Face } from "@/components/dash/Face";
import { Panel } from "@/components/dash/Panel";
import { initials } from "@/components/racing/initials";
import { useStandings } from "@/features/hub/api";
import { useCurrentSeason } from "@/features/hub/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { useAgo } from "../useAgo";

type Headline = Schema<"Headline">;
type Line = Schema<"StandingLine">;

/** The publisher's picture (ADR 0015), else a plain tile with an icon. */
function Thumb({ headline, className }: { headline: Headline; className: string }) {
  const [failed, setFailed] = useState(false);
  if (headline.image_url && !failed) {
    return (
      <img
        src={headline.image_url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center bg-raised text-muted ${className}`}
    >
      <Newspaper className="size-6" />
    </span>
  );
}

/** Whole-word, case-insensitive match of a name in a headline. */
function names(title: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(title);
}

/**
 * Headlines as a wire with a reader: filter by source, pick one, read its title with the
 * drivers and teams it names and where they stand. The article itself stays on the
 * publisher's site (ADR 0012).
 */
export function NewsWire({ headlines }: { headlines: readonly Headline[] }) {
  const { t } = useI18n();
  const ago = useAgo();
  const [source, setSource] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const sources = [...new Map(headlines.map((h) => [h.source, h.source_name])).entries()];
  const shown = headlines.filter((h) => source === null || h.source === source);
  const current = shown.find((h) => h.url === picked) ?? shown[0];

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t("news.sourceFilter")} className="flex flex-wrap gap-2">
        {[[null, t("news.allSources")] as const, ...sources].map(([key, label]) => (
          <button
            key={key ?? "all"}
            type="button"
            aria-pressed={source === key}
            onClick={() => {
              setSource(key);
            }}
            className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm font-semibold text-muted aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="flex max-h-[calc(100vh-10rem)] flex-col overflow-y-auto rounded-xl border border-line bg-panel">
          {shown.map((h) => {
            const active = h === current;
            return (
              <li key={h.url} className="border-b border-line last:border-0">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`${h.title} · ${t("news.pick")}`}
                  onClick={() => {
                    setPicked(h.url);
                  }}
                  className={`flex w-full gap-3 p-3 text-left transition-colors ${
                    active ? "bg-raised" : "hover:bg-raised/60"
                  }`}
                >
                  <Thumb headline={h} className="h-16 w-24 shrink-0 rounded-md" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="line-clamp-2 leading-snug font-semibold">{h.title}</span>
                    <span className="text-xs text-muted">
                      {h.source_name} · {ago(h.published_at)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {current && <Reader headline={current} />}
      </div>
    </div>
  );
}

function Reader({ headline }: { headline: Headline }) {
  const { t } = useI18n();
  const ago = useAgo();
  return (
    <article className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <Thumb headline={headline} className="aspect-[16/9] w-full" />
        <div className="flex flex-col gap-3 p-5">
          <p className="text-xs font-bold text-mark-text uppercase">
            {headline.source_name} · {ago(headline.published_at)}
          </p>
          <h2 className="text-2xl leading-snug font-bold">{headline.title}</h2>
          <a
            href={headline.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-action px-4 py-2.5 font-semibold text-white hover:brightness-110"
          >
            {t("news.readOn", { source: headline.source_name })}
            <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only"> {t("news.opensNew")}</span>
          </a>
        </div>
      </div>
      <Context title={headline.title} />
    </article>
  );
}

/** Drivers and teams of the current season named in the headline, with their standing. */
function Context({ title }: { title: string }) {
  const { t, f } = useI18n();
  const { season } = useCurrentSeason();
  const standings = useStandings(season ?? 0, null, season !== null).data;
  const drivers = (standings?.drivers ?? []).filter(
    (line) => line.driver && names(title, line.driver.family_name),
  );
  const teams = (standings?.constructors ?? []).filter(
    (line) => line.team && names(title, line.team.name.replace(/ F1 Team$/, "")),
  );
  const lines: Line[] = [...drivers, ...teams];
  return (
    <Panel title={t("news.context")} icon={<Users />} bodyClassName="gap-2 p-4">
      {lines.length === 0 ? (
        <p className="text-sm text-muted">{t("news.noContext")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {lines.map((line) => {
              const driver = line.driver;
              const key = driver?.ref ?? line.team?.ref ?? "";
              return (
                <li key={key}>
                  <Link
                    to={driver ? `/drivers/${driver.ref}` : `/teams/${line.team?.ref ?? ""}`}
                    className="flex items-center gap-3 rounded-lg border border-line p-2 hover:bg-raised"
                  >
                    {driver ? (
                      <Face
                        url={driver.photo_url}
                        label={driver.code ?? initials(driver.given_name, driver.family_name)}
                        colour={line.colour}
                        className="size-10 shrink-0 rounded-full text-xs"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="h-10 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: teamColour(line.colour) }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {driver ? `${driver.given_name} ${driver.family_name}` : line.team?.name}
                    </span>
                    <span className="num text-sm text-muted">
                      P{line.position_text} · {f.number(line.points ?? 0, 0)} pts
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">{t("news.contextNote")}</p>
        </>
      )}
    </Panel>
  );
}
