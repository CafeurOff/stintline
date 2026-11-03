import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";

import { useSessionDetail, useStints } from "../api";
import { entriesByCar } from "../entries";
import { strategyCounts } from "../strategy";
import { useRequiredSessionId } from "../useSessionId";
import { ClassificationTable } from "./ClassificationTable";
import { PitLossCard } from "./PitLossCard";
import { Podium } from "./Podium";
import { StintTable } from "./StintTable";
import { StintTimeline } from "./StintTimeline";

export function StrategyPage() {
  const sessionId = useRequiredSessionId();
  const session = useSessionDetail(sessionId);
  const stints = useStints(sessionId);

  if (!session.data) return null;
  const entries = session.data.entries;
  const totalLaps = session.data.total_laps ?? 0;

  return (
    <div className="space-y-6">
      <Podium entries={entries} />
      <Card title="Tyre strategy" eyebrow="Stints">
        {stints.isPending ? (
          <Skeleton className="h-96" label="Loading stints…" />
        ) : stints.isError ? (
          <ErrorState error={stints.error} onRetry={() => void stints.refetch()} />
        ) : stints.data.length === 0 || totalLaps === 0 ? (
          <EmptyState title="No stint data for this session" />
        ) : (
          <>
            <StrategySummary rows={stints.data} />
            <StintTimeline
              rows={stints.data}
              totalLaps={totalLaps}
              neutralisations={session.data.neutralisations}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-text-muted hover:text-text">
                Show stints as a table
              </summary>
              <StintTable rows={stints.data} entries={entriesByCar(entries)} />
            </details>
          </>
        )}
      </Card>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Classification" eyebrow="Result">
          <ClassificationTable entries={entries} stints={stints.data ?? []} />
        </Card>
        <PitLossCard sessionId={sessionId} />
      </div>
    </div>
  );
}

function StrategySummary({ rows }: { rows: Parameters<typeof strategyCounts>[0] }) {
  const counts = strategyCounts(rows).slice(0, 3);
  if (counts.length === 0) return null;
  return (
    <p className="mb-3 text-sm text-text-muted">
      Most used:{" "}
      {counts.map(([label, n], index) => (
        <span key={label}>
          {index > 0 && ", "}
          <span className="font-semibold text-text">{label}</span> ({n}{" "}
          {n === 1 ? "driver" : "drivers"})
        </span>
      ))}
      .
    </p>
  );
}
