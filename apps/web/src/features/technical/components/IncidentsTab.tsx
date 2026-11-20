import type { Schema } from "@stintline/api-types";
import { FileText, Gauge, Layers, ListOrdered, ShieldAlert, TriangleAlert } from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { RoundBars } from "@/components/racing/RoundBars";
import { DriverChip } from "@/features/analysis/components/AnalysisParts";
import { PenaltyTags } from "@/features/paddock/components/PenaltyTags";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";
import { teamColour } from "@/lib/teams";

import { useIncidents } from "../api";
import { TabLoading } from "./TabLoading";

type Incidents = Schema<"Incidents">;

/** Where the decisions were taken: race, sprint, qualifying, practice, other. */
function SessionsPanel({ decisions }: { decisions: Incidents["decisions"] }) {
  const { t } = useI18n();
  const groups = ["race", "sprint", "qualifying", "practice", "other"] as const;
  const group = (label: string): (typeof groups)[number] => {
    const lowered = label.toLowerCase();
    if (lowered.includes("sprint")) return "sprint";
    if (lowered.includes("qualifying")) return "qualifying";
    if (lowered.includes("practice")) return "practice";
    if (lowered === "race") return "race";
    return "other";
  };
  const counts = groups.map((g) => {
    const mine = decisions.filter((d) => group(d.session_label) === g);
    return { g, n: mine.length, p: mine.filter((d) => d.is_penalty).length };
  });
  const max = Math.max(1, ...counts.map((c) => c.n));
  return (
    <Panel title={t("tech.inc.sessions")} icon={<ListOrdered />} bodyClassName="gap-2 p-5">
      {counts.map(({ g, n, p }) => (
        <div key={g} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0">{t(`tech.session.${g}`)}</span>
          <span
            className="flex h-2 flex-1 overflow-hidden rounded-full bg-raised"
            aria-hidden="true"
          >
            <span className="bg-loss" style={{ width: `${String((p / max) * 100)}%` }} />
            <span className="bg-muted/50" style={{ width: `${String(((n - p) / max) * 100)}%` }} />
          </span>
          <span className="num w-24 shrink-0 text-right text-muted">
            {t("tech.inc.kindCount", { n, p })}
          </span>
        </div>
      ))}
    </Panel>
  );
}

export function IncidentsTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = useIncidents(year);
  return (
    <TabLoading query={query} empty={t("tech.inc.empty")}>
      {(data) => <IncidentsView data={data} />}
    </TabLoading>
  );
}

function kindKey(kind: string): MessageKey {
  return `tech.kind.${kind}` as MessageKey;
}

function IncidentsView({ data }: { data: Incidents }) {
  const { t, locale } = useI18n();
  const penalties = data.decisions.filter((d) => d.is_penalty).length;
  const mostPenalised = [...data.drivers].sort((a, b) => b.penalties - a.penalties)[0];
  const topPoints = data.drivers[0];
  const maxKind = Math.max(1, ...data.kinds.map((k) => k.decisions));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label={t("tech.inc.decisions")} icon={<FileText />}>
          <p className="num display text-4xl">{data.decisions.length}</p>
          <p className="text-sm text-muted">
            {t("tech.inc.decisionsNote", { n: data.rounds.length })}
          </p>
        </Tile>
        <Tile label={t("tech.inc.penalties")} icon={<ShieldAlert />}>
          <p className="num display text-4xl text-loss">{penalties}</p>
          <p className="text-sm text-muted">{t("docs.tile.penaltiesNote")}</p>
        </Tile>
        <Tile label={t("tech.inc.most")} icon={<TriangleAlert />}>
          <p className="num display text-4xl">{mostPenalised?.penalties ?? 0}</p>
          {mostPenalised && (
            <DriverChip driver={mostPenalised.driver} colour={mostPenalised.colour} size="size-7" />
          )}
        </Tile>
        <Tile label={t("tech.inc.points")} icon={<Gauge />}>
          <p className="num display text-4xl">
            {topPoints?.points_12m ?? 0}
            <span className="text-xl text-muted">/{data.threshold}</span>
          </p>
          {topPoints && (
            <DriverChip driver={topPoints.driver} colour={topPoints.colour} size="size-7" />
          )}
        </Tile>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex min-w-0 flex-col gap-4 self-start">
          <Panel title={t("tech.inc.kinds")} icon={<Layers />} bodyClassName="gap-2 p-5">
            {data.kinds.map((k) => (
              <div key={k.kind} className="flex flex-col gap-1">
                <p className="flex justify-between text-sm">
                  <span>{t(kindKey(k.kind))}</span>
                  <span className="num text-muted">
                    {t("tech.inc.kindCount", { n: k.decisions, p: k.penalties })}
                  </span>
                </p>
                <span
                  className="flex h-2 overflow-hidden rounded-full bg-raised"
                  aria-hidden="true"
                >
                  <span
                    className="bg-loss"
                    style={{ width: `${String((k.penalties / maxKind) * 100)}%` }}
                  />
                  <span
                    className="bg-muted/50"
                    style={{ width: `${String(((k.decisions - k.penalties) / maxKind) * 100)}%` }}
                  />
                </span>
              </div>
            ))}
            <p className="text-xs text-muted">{t("tech.inc.kindsNote")}</p>
          </Panel>
          <SessionsPanel decisions={data.decisions} />
        </div>
        <Panel title={t("tech.inc.licence")} icon={<ShieldAlert />}>
          <div className="relative overflow-x-auto">
            <table className="data-table text-sm">
              <caption className="sr-only">{t("tech.inc.licence")}</caption>
              <thead>
                <tr>
                  <th>{t("col.driver")}</th>
                  <th className="min-w-36">{t("tech.inc.points12")}</th>
                  <th className="min-w-32">{t("tech.inc.byRound")}</th>
                  <th className="num">{t("tech.inc.season")}</th>
                  <th className="num">{t("tech.inc.penalties")}</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((d) => (
                  <tr key={d.driver.ref}>
                    <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                      <DriverChip driver={d.driver} colour={d.colour} size="size-7" compact />
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <span className="num w-8 font-semibold">{d.points_12m}</span>
                        <span
                          className="h-2 flex-1 overflow-hidden rounded-full bg-raised"
                          aria-hidden="true"
                        >
                          <span
                            className={`block h-full rounded-full ${d.points_12m >= data.threshold - 2 ? "bg-loss" : "bg-t-yellow"}`}
                            style={{
                              width: `${String(Math.min(1, d.points_12m / data.threshold) * 100)}%`,
                            }}
                          />
                        </span>
                      </span>
                    </td>
                    <td>
                      <RoundBars
                        colour={teamColour(d.colour)}
                        bars={d.points_by_round.map((points, i) => ({
                          key: String(i),
                          kind: points > 0 ? ("hit" as const) : ("miss" as const),
                          value: points / data.threshold,
                          label: `${data.rounds[i] ? eventName(data.rounds[i].name, locale) : ""}: ${String(points)}`,
                        }))}
                      />
                    </td>
                    <td className="num">{d.points}</td>
                    <td className="num text-muted">{d.penalties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            {t("tech.inc.licenceNote", { n: data.threshold })}
          </p>
        </Panel>
      </div>
      <Panel title={t("tech.inc.list")} icon={<ListOrdered />}>
        <div className="relative max-h-[70vh] overflow-auto">
          <table className="data-table text-sm">
            <caption className="sr-only">{t("tech.inc.list")}</caption>
            <thead>
              <tr>
                <th className="num">{t("col.round")}</th>
                <th>{t("col.driver")}</th>
                <th>{t("tech.inc.kind")}</th>
                <th>{t("docs.fact")}</th>
                <th>{t("docs.decision")}</th>
                <th>
                  <span className="sr-only">{t("docs.document")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data.decisions].reverse().map((d) => (
                <tr key={d.document_id}>
                  <td className="num">
                    <span className="flex items-center gap-1.5">
                      <Flag country={d.country} />
                      {d.round}
                    </span>
                  </td>
                  <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                    {d.driver ? (
                      <DriverChip driver={d.driver} colour={d.colour} size="size-6" compact />
                    ) : (
                      d.driver_name
                    )}
                  </td>
                  <td className="text-xs whitespace-nowrap text-muted">{t(kindKey(d.kind))}</td>
                  <td className="max-w-96 text-muted">{d.fact}</td>
                  <td>
                    <PenaltyTags ruling={d} />
                  </td>
                  <td>
                    <Link
                      to={`/documents?season=${String(data.season)}&event=${String(d.event_id)}&doc=${String(d.document_id)}`}
                      className="text-sm font-semibold text-mark-text hover:underline"
                    >
                      {t("docs.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
