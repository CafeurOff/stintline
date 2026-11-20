import { Link } from "react-router";
import { Scale } from "lucide-react";

import { ShowAll } from "@/components/layout/Collapsible";
import { Panel } from "@/components/layout/Panel";
import { useCollapsed } from "@/components/layout/useCollapsed";
import { useDecisions } from "@/features/paddock/api";
import { DecisionTable } from "@/features/paddock/components/DecisionTable";
import { useI18n } from "@/lib/i18n/context";

/** Races first, then qualifying and practice: what changed the result comes first. */
const DECISION_ORDER = ["R", "SPRINT", "Q", "SQ", "FP3", "FP2", "FP1"];

/** Decisions shown before "show all": a weekend can have forty. */
const DECISIONS_SHOWN = 8;

function decisionRank(kind: string | null | undefined): number {
  const index = DECISION_ORDER.indexOf(kind ?? "");
  return index === -1 ? DECISION_ORDER.length : index;
}

/** Stewards' decisions of the weekend (ADR 0018); nothing when there are none. */
export function StewardsPanel({ eventId, season }: { eventId: number; season: number }) {
  const { t } = useI18n();
  const decisions = useDecisions({ event: eventId });
  const sorted = [...(decisions.data ?? [])].sort(
    (a, b) => decisionRank(a.session_kind) - decisionRank(b.session_kind),
  );
  const collapsed = useCollapsed(sorted, DECISIONS_SHOWN);
  if (sorted.length === 0) return null;
  return (
    <Panel
      title={t("docs.decisions")}
      icon={<Scale />}
      action={
        <Link
          to={`/documents?season=${String(season)}&event=${String(eventId)}`}
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          {t("event.allDocuments")}
        </Link>
      }
    >
      <DecisionTable decisions={collapsed.shown} />
      {collapsed.hidden > 0 || collapsed.open ? (
        <div className="flex px-5 pt-1 pb-5">
          <ShowAll
            hidden={collapsed.hidden}
            open={collapsed.open}
            onToggle={() => {
              collapsed.setOpen(!collapsed.open);
            }}
          />
        </div>
      ) : null}
    </Panel>
  );
}
