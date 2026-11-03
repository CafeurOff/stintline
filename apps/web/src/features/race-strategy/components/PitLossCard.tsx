import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { Stat } from "@/components/ui/Stat";
import { formatSeconds } from "@/lib/format";

import { usePitLoss } from "../api";

/** Time lost by a stop at this circuit, under green flag and under neutralisations. */
export function PitLossCard({ sessionId }: { sessionId: number }) {
  const pitLoss = usePitLoss(sessionId);
  return (
    <Card title="Pit loss" eyebrow="Circuit">
      {pitLoss.isPending ? (
        <Skeleton className="h-40" label="Loading pit loss…" />
      ) : pitLoss.isError ? (
        <ErrorState error={pitLoss.error} onRetry={() => void pitLoss.refetch()} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4">
            <Stat
              label="Green flag"
              tone="accent"
              value={formatSeconds(pitLoss.data.green_s)}
              hint={`± ${formatSeconds(pitLoss.data.green_sigma_s)} · ${pitLoss.data.n_green} stops`}
            />
            <Stat
              label="Under SC"
              value={formatSeconds(pitLoss.data.assumed_sc_s)}
              hint={
                pitLoss.data.neutralised.find((n) => n.status === "SC")
                  ? "observed"
                  : "assumed from green"
              }
            />
            <Stat
              label="Under VSC"
              value={formatSeconds(pitLoss.data.assumed_vsc_s)}
              hint={
                pitLoss.data.neutralised.find((n) => n.status === "VSC")
                  ? "observed"
                  : "assumed from green"
              }
            />
            <Stat
              label="Outliers"
              value={pitLoss.data.stops.filter((stop) => stop.outlier).length}
              hint="stops excluded"
            />
          </dl>
          <p className="mt-4 text-xs text-text-muted">
            Pit loss is the race time lost against staying out, measured from every stop and
            including the out-lap on new tyres. The median of green-flag stops is used.
          </p>
        </>
      )}
    </Card>
  );
}
