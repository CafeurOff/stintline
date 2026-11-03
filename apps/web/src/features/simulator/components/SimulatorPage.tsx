import { EmptyState } from "@/components/ui/States";
import { useSessionDetail } from "@/features/race-strategy/api";
import { byFinish } from "@/features/race-strategy/entries";
import { useRequiredSessionId } from "@/features/race-strategy/useSessionId";

import { PitExitSimulator } from "./PitExitSimulator";
import { UndercutSimulator } from "./UndercutSimulator";

/** Minimum race length for a stop to be simulated (a stop needs laps either side). */
const MIN_LAPS = 4;

export function SimulatorPage() {
  const sessionId = useRequiredSessionId();
  const session = useSessionDetail(sessionId);
  if (!session.data) return null;

  const totalLaps = session.data.total_laps ?? 0;
  const entries = [...session.data.entries].sort(byFinish);
  if (totalLaps < MIN_LAPS || entries.length < 2)
    return <EmptyState title="This session cannot be simulated" />;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <UndercutSimulator sessionId={sessionId} entries={entries} totalLaps={totalLaps} />
      <PitExitSimulator sessionId={sessionId} entries={entries} totalLaps={totalLaps} />
    </div>
  );
}
