import type { Schema } from "@stintline/api-types";
import { Battery, FileText, ShieldAlert, TriangleAlert, Wrench } from "lucide-react";
import { Link } from "react-router";

import { Panel, Tile } from "@/components/layout/Panel";
import { Flag } from "@/components/racing/Flag";
import { DriverChip } from "@/features/analysis/components/AnalysisParts";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";
import { teamColour } from "@/lib/teams";

import { usePowerUnits } from "../api";
import { TabLoading } from "./TabLoading";

type PowerUnits = Schema<"PowerUnits">;

export function PowerUnitsTab({ year }: { year: number }) {
  const { t } = useI18n();
  const query = usePowerUnits(year);
  return (
    <TabLoading query={query} empty={t("tech.pu.empty")}>
      {(data) => <PowerUnitsView data={data} />}
    </TabLoading>
  );
}

function PowerUnitsView({ data }: { data: PowerUnits }) {
  const { t, locale } = useI18n();
  const beyond = data.cars.filter((c) => c.over.length > 0 || c.beyond > 0);
  const total = (c: PowerUnits["cars"][number]) => Object.values(c.used).reduce((a, b) => a + b, 0);
  const most = [...data.cars].sort((a, b) => total(b) - total(a))[0];
  const nonCompliant = data.cars.reduce((sum, c) => sum + c.beyond, 0);
  const changes = data.cars
    .flatMap((c) => c.changes.map((change) => ({ car: c, change })))
    .sort((a, b) => b.change.round - a.change.round);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Tile label={t("tech.pu.asOf")} icon={<FileText />}>
          <p className="num display text-4xl">{t("tech.round", { n: data.as_of.round })}</p>
          <p className="flex items-center gap-2 text-sm text-muted">
            <Flag country={data.as_of.country} />
            {eventName(data.as_of.name, locale)}
          </p>
        </Tile>
        <Tile label={t("tech.pu.beyond")} icon={<TriangleAlert />}>
          <p className="num display text-4xl text-loss">{beyond.length}</p>
          <p className="text-sm text-muted">{t("tech.pu.beyondNote")}</p>
        </Tile>
        <Tile label={t("tech.pu.most")} icon={<Battery />}>
          <p className="num display text-4xl">{most ? total(most) : "—"}</p>
          {most?.driver && <DriverChip driver={most.driver} colour={most.colour} size="size-7" />}
        </Tile>
        <Tile label={t("tech.pu.nonCompliant")} icon={<ShieldAlert />}>
          <p className="num display text-4xl">{nonCompliant}</p>
          <p className="text-sm text-muted">{t("tech.pu.nonCompliantNote")}</p>
        </Tile>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title={t("tech.pu.matrix")}
          icon={<Battery />}
          action={
            <Link
              to={`/documents?season=${String(data.season)}&event=${String(data.as_of.event_id)}&doc=${String(data.document_id)}`}
              className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
            >
              <FileText aria-hidden="true" className="size-4" /> {t("tech.document")}
            </Link>
          }
        >
          <div className="relative overflow-x-auto">
            <table className="data-table text-sm">
              <caption className="sr-only">{t("tech.pu.matrix")}</caption>
              <thead>
                <tr>
                  <th>{t("col.driver")}</th>
                  {data.elements.map((e) => (
                    <th key={e} className="num" title={t(`tech.element.${e}` as MessageKey)}>
                      {e}
                      {data.allowed[e] !== undefined && (
                        <span className="block text-[0.65rem] text-muted normal-case">
                          {t("tech.pu.allowed", { n: data.allowed[e] ?? 0 })}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cars.map((car) => (
                  <tr key={car.car_number}>
                    <td className="border-l-4" style={{ borderLeftColor: teamColour(car.colour) }}>
                      {car.driver ? (
                        <DriverChip driver={car.driver} colour={car.colour} size="size-7" compact />
                      ) : (
                        car.team_and_driver
                      )}
                    </td>
                    {data.elements.map((e) => {
                      const used = car.used[e];
                      const allowed = data.allowed[e];
                      const state =
                        used === undefined || allowed === undefined
                          ? "plain"
                          : used > allowed
                            ? "over"
                            : used === allowed
                              ? "at"
                              : "plain";
                      return (
                        <td
                          key={e}
                          className={`num text-center font-semibold ${
                            state === "over"
                              ? "bg-loss/15 text-loss"
                              : state === "at"
                                ? "bg-t-yellow/15 text-t-yellow"
                                : ""
                          }`}
                        >
                          {used ?? "—"}
                          {state === "over" && (
                            <span className="sr-only"> {t("tech.pu.overSr")}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">{t("tech.pu.note")}</p>
        </Panel>
        <Panel title={t("tech.pu.changes")} icon={<Wrench />} className="self-start">
          <ul className="flex max-h-[70vh] flex-col divide-y divide-line overflow-y-auto">
            {changes.map(({ car, change }) => (
              <li
                key={`${String(car.car_number)}-${String(change.event_id)}-${change.element}-${String(change.number)}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs text-muted">
                  <Flag country={change.country} />
                  {t("tech.round", { n: change.round })}
                </span>
                <span className="min-w-0 flex-1">
                  {car.driver ? (
                    <DriverChip driver={car.driver} colour={car.colour} size="size-6" compact />
                  ) : (
                    car.team_and_driver
                  )}
                </span>
                <span className="num text-sm font-semibold">
                  {change.element} {change.number}
                  {change.allowed != null && <span className="text-muted">/{change.allowed}</span>}
                </span>
                {change.compliant === false && (
                  <span className="rounded-md border border-loss/40 bg-loss/15 px-1.5 py-0.5 text-[0.65rem] font-bold text-loss uppercase">
                    {t("tech.pu.overTag")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
