import { Link, Outlet } from "react-router";

import { NavTabs } from "@/components/ui/NavTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { ApiError } from "@/lib/errors";
import { formatDate } from "@/lib/format";

import { useSessionDetail } from "../api";
import { useSessionId } from "../useSessionId";

const KIND_LABEL = {
  FP1: "Practice 1",
  FP2: "Practice 2",
  FP3: "Practice 3",
  SQ: "Sprint qualifying",
  SPRINT: "Sprint",
  Q: "Qualifying",
  R: "Race",
} as const;

/** Header and tabs shared by the strategy, degradation and simulator views of a session. */
export function SessionLayout() {
  const sessionId = useSessionId();
  if (sessionId === null) return <NotFoundPage />;
  return <SessionShell sessionId={sessionId} />;
}

function SessionShell({ sessionId }: { sessionId: number }) {
  const session = useSessionDetail(sessionId);
  const base = `/sessions/${sessionId}`;

  if (session.isPending) return <Skeleton className="mt-8 h-40" label="Loading session…" />;
  if (session.isError) {
    if (session.error instanceof ApiError && session.error.status === 404) return <NotFoundPage />;
    return (
      <div className="py-8">
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    );
  }

  const { event } = session.data;
  return (
    <div className="space-y-6 py-6">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-panel to-surface px-5 pt-5 shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-0 size-56 rounded-full bg-accent/15 blur-3xl"
        />
        <nav aria-label="Breadcrumb" className="text-xs text-text-muted">
          <Link to={`/?season=${event.season}`} className="hover:text-text">
            {event.season} season
          </Link>
          <span aria-hidden="true"> / </span>
          <span>Round {event.round}</span>
        </nav>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <p className="text-sm text-text-muted">
              {event.circuit.name} · {event.circuit.locality}, {event.circuit.country} ·{" "}
              {formatDate(event.race_date)}
            </p>
          </div>
          <dl className="flex gap-6 pb-1 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Session</dt>
              <dd className="font-semibold">{KIND_LABEL[session.data.kind]}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Laps</dt>
              <dd className="tabular font-semibold">{session.data.total_laps ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Neutralisations</dt>
              <dd className="tabular font-semibold">{session.data.neutralisations.length}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4">
          <NavTabs
            label="Session views"
            tabs={[
              { to: base, label: "Strategy", end: true },
              { to: `${base}/degradation`, label: "Degradation" },
              { to: `${base}/simulator`, label: "Simulator" },
            ]}
          />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
