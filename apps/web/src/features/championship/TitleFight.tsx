import type { Schema } from "@stintline/api-types";
import { Calculator } from "lucide-react";

import { Panel } from "@/components/layout/Panel";
import { DriverName } from "@/components/hub/DriverName";
import { Skeleton } from "@/components/ui/Skeleton";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { useTitle } from "./api";
import { type TitleSummary, titleSummary } from "./summary";

type Row = Schema<"Title">["drivers"][number];
/** Drivers drawn: the fight, not the whole grid. */
const ROWS = 6;

/** One sentence on the state of the title: settled, settable next time out, or open. */
export function TitleSentence({ summary }: { summary: TitleSummary }) {
  const { t, f, locale } = useI18n();
  if (!summary) return null;
  if (summary.kind === "decided") {
    return (
      <p>
        {t("title.decided", {
          name: summary.champion.driver.family_name,
          round: summary.round.round,
          race: eventName(summary.round.name, locale),
        })}{" "}
        {summary.spare > 0 && (
          <span className="text-muted">
            {summary.spare === 1 ? t("title.spare.one") : t("title.spare", { n: summary.spare })}
          </span>
        )}
      </p>
    );
  }
  if (summary.kind === "clinch") {
    return (
      <div className="flex flex-col gap-1">
        <p>
          {t("title.clinchAt", {
            name: summary.leader.driver.family_name,
            race: eventName(summary.next.name, locale),
          })}
        </p>
        <ul className="list-disc pl-5 text-sm">
          {summary.rivals.map(({ rival, margin }) => (
            <li key={rival.driver.ref}>
              {margin > 0
                ? t("title.beatBy", {
                    rival: rival.driver.family_name,
                    n: f.number(margin, margin % 1 ? 1 : 0),
                  })
                : margin === 0
                  ? t("title.beat", { rival: rival.driver.family_name })
                  : t("title.unless", {
                      rival: rival.driver.family_name,
                      n: f.number(-margin, margin % 1 ? 1 : 0),
                    })}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const { title } = summary;
  return (
    <p>
      {t("title.open", {
        n: summary.contenders.length + 1,
        races: title.races_left,
        points: f.number(title.points_left, 0),
      })}
      {title.sprints_left > 0 &&
        ` ${title.sprints_left === 1 ? t("title.sprints.one") : t("title.sprints", { n: title.sprints_left })}`}
    </p>
  );
}

function statusLabel(row: Row, t: ReturnType<typeof useI18n>["t"]): string {
  return t(`title.status.${row.status}`);
}

/**
 * The title fight: who can still be champion and how far each driver can go. Each bar runs
 * from zero to the most points the driver can still finish with; the solid part is what
 * counts today, and the line marks the leader.
 */
export function TitleFight({
  year,
  colours,
}: {
  year: number;
  /** Team colour of each driver (by driver ref), from the standings. */
  colours: ReadonlyMap<string, string | null | undefined>;
}) {
  const { t, f } = useI18n();
  const title = useTitle(year);
  if (title.isError) return null;
  // About the panel's height with its usual rows, so the table below does not jump.
  if (!title.data) return <Skeleton className="h-[26.5rem] sm:h-80" />;
  const data = title.data;
  const summary = titleSummary(data);
  const shown = data.drivers.filter((row) => row.status !== "out").slice(0, ROWS);
  const rows = shown.length > 1 ? shown : data.drivers.slice(0, Math.min(3, ROWS));
  const top = Math.max(...rows.map((row) => row.ceiling), 1);
  const leader = data.drivers[0]?.points ?? 0;
  return (
    <Panel title={t("title.panel")} icon={<Calculator />} bodyClassName="gap-4 p-5">
      <TitleSentence summary={summary} />
      <ol className="flex flex-col gap-3" aria-label={t("title.bars")}>
        {rows.map((row) => {
          const colour = teamColour(colours.get(row.driver.ref) ?? null);
          return (
            <li key={row.driver.ref} className="grid grid-cols-[minmax(0,13rem)_1fr] gap-3">
              <div className="flex min-w-0 flex-col">
                <DriverName driver={row.driver} avatar="xs" />
                <span className="text-xs text-muted">{statusLabel(row, t)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="relative h-3 overflow-hidden rounded-full bg-raised">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 opacity-35"
                    style={{
                      width: `${String((row.ceiling / top) * 100)}%`,
                      backgroundColor: colour,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${String((row.points / top) * 100)}%`,
                      backgroundColor: colour,
                    }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 w-0.5 bg-ink"
                    style={{ left: `${String((leader / top) * 100)}%` }}
                  />
                </div>
                <span className="num text-xs text-muted">
                  {t("title.reach", {
                    points: f.number(row.points, row.points % 1 ? 1 : 0),
                    max: f.number(row.ceiling, row.ceiling % 1 ? 1 : 0),
                  })}
                  {row.scored !== row.points &&
                    ` · ${t("title.scored", { n: f.number(row.scored, row.scored % 1 ? 1 : 0) })}`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-muted">
        {data.rules.all_count ? t("title.note") : t("title.noteBest")}
      </p>
    </Panel>
  );
}
