import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { formatDate } from "@/lib/format";

type Event = Schema<"Event">;

const SESSION_LABEL: Record<Schema<"KindEnum">, string> = {
  FP1: "Practice 1",
  FP2: "Practice 2",
  FP3: "Practice 3",
  SQ: "Sprint qualifying",
  SPRINT: "Sprint",
  Q: "Qualifying",
  R: "Race",
};

/** One Grand Prix. Sessions with timing data link to their strategy view. */
export function EventCard({ event }: { event: Event }) {
  const analysable = event.sessions.filter((session) => session.has_data);
  const hasData = analysable.length > 0;

  return (
    <li
      className={`relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition ${
        hasData
          ? "border-border bg-surface shadow-soft hover:border-border-strong"
          : "border-dashed border-border bg-panel"
      }`}
    >
      {hasData && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-accent to-accent/0"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="tabular text-xs font-semibold tracking-wider text-text-muted uppercase">
            Round {event.round} · {formatDate(event.race_date)}
          </p>
          <h3 className="mt-0.5 text-base font-semibold tracking-tight">{event.name}</h3>
          <p className="text-sm text-text-muted">
            {event.circuit.name}, {event.circuit.country}
          </p>
        </div>
        {event.format === "sprint" && (
          <span className="rounded-full bg-accent-tint px-2 py-0.5 text-xs font-medium text-accent-text">
            Sprint
          </span>
        )}
      </div>
      {hasData ? (
        <div className="mt-auto flex flex-wrap gap-2">
          {analysable.map((session) => (
            <Link
              key={session.id}
              to={`/sessions/${session.id}`}
              aria-label={`${event.name}: ${SESSION_LABEL[session.kind]} strategy`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110"
            >
              {SESSION_LABEL[session.kind]}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-auto text-xs text-text-muted">No timing data loaded</p>
      )}
    </li>
  );
}
