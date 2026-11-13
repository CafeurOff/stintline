import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { Flag } from "@/components/racing/Flag";
import { DriverChip } from "@/features/insights/components/common";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { PenaltyTags } from "./PenaltyTags";

type Decision = Schema<"Decision">;

/** Stewards' decisions as a table: driver, session, lap, what happened, the ruling. */
export function DecisionTable({
  decisions,
  onOpen,
  showEvent = false,
}: {
  decisions: readonly Decision[];
  onOpen?: (documentId: number) => void;
  showEvent?: boolean;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="relative overflow-x-auto">
      <table className="data-table text-sm">
        <caption className="sr-only">{t("docs.decisions")}</caption>
        <thead>
          <tr>
            <th>{t("col.driver")}</th>
            {showEvent && <th>{t("col.grandPrix")}</th>}
            <th>{t("docs.session")}</th>
            <th className="num">{t("docs.lap")}</th>
            <th>{t("docs.fact")}</th>
            <th>{t("docs.decision")}</th>
            <th>
              <span className="sr-only">{t("docs.document")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={d.document_id}>
              <td className="border-l-4" style={{ borderLeftColor: teamColour(d.colour) }}>
                {d.driver ? (
                  <DriverChip driver={d.driver} colour={d.colour} size="size-7" compact />
                ) : (
                  d.driver_name
                )}
              </td>
              {showEvent && (
                <td>
                  <Link
                    to={`/documents?season=${String(d.event.season)}&event=${String(d.event.id)}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Flag country={d.event.country} />
                    <span className="truncate">{eventName(d.event.name, locale)}</span>
                  </Link>
                </td>
              )}
              <td className="text-muted">{d.session_label}</td>
              <td className="num">{d.lap ?? "—"}</td>
              <td className="max-w-80 text-muted">{d.fact}</td>
              <td>
                <PenaltyTags ruling={d} />
              </td>
              <td>
                {onOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(d.document_id);
                    }}
                    className="text-sm font-semibold text-mark-text hover:underline"
                  >
                    {t("docs.open")}
                  </button>
                ) : (
                  <Link
                    to={`/documents?season=${String(d.event.season)}&event=${String(d.event.id)}&doc=${String(d.document_id)}`}
                    className="text-sm font-semibold text-mark-text hover:underline"
                  >
                    {t("docs.open")}
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
