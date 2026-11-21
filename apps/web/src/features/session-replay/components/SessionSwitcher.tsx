import { Link } from "react-router";

import { useI18n } from "@/lib/i18n/context";
import { useEvent } from "@/lib/queries";
import { sessionShort } from "@/lib/sessions";

/**
 * The sessions of the weekend, in running order: a link to each replay that is ready, the
 * others shown with why they cannot be opened yet (never a dead link).
 */
export function SessionSwitcher({ eventId, current }: { eventId: number; current: number }) {
  const { t } = useI18n();
  const event = useEvent(eventId);
  const sessions = event.data?.sessions ?? [];
  if (sessions.length < 2) return null;
  const state = {
    pending: t("event.sessionPending"),
    upcoming: t("event.sessionUpcoming"),
    none: t("event.sessionNone"),
  } as const;

  return (
    <nav aria-label={t("sreplay.sessions")} className="flex flex-wrap gap-1.5">
      {sessions.map((session) => {
        const label = sessionShort(session.kind, t);
        if (session.id === current) {
          return (
            <span
              key={session.id}
              aria-current="page"
              className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-bg"
            >
              {label}
            </span>
          );
        }
        if (session.replay === "ready") {
          return (
            <Link
              key={session.id}
              to={`/sessions/${String(session.id)}`}
              className="rounded-full border border-line px-3 py-1 text-xs font-bold text-muted transition hover:border-ink hover:text-ink"
            >
              {label}
            </Link>
          );
        }
        return (
          <span
            key={session.id}
            title={state[session.replay]}
            className="rounded-full border border-dashed border-line px-3 py-1 text-xs font-semibold text-muted/70"
          >
            {label}
            <span className="sr-only"> ({state[session.replay]})</span>
          </span>
        );
      })}
    </nav>
  );
}
