import type { Schema } from "@stintline/api-types";
import { Clock, Loader, Play } from "lucide-react";
import { Link } from "react-router";

import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";

type Session = Schema<"Event">["sessions"][number];

/**
 * Every session of the weekend with what can be done with it: open its replay, or why not
 * yet (being imported, still to run). Hidden for seasons without lap timing.
 */
export function WeekendSessions({ sessions }: { sessions: readonly Session[] }) {
  const { t, locale } = useI18n();
  if (!sessions.some((s) => s.replay !== "none")) return null;
  const when = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section aria-labelledby="weekend-sessions" className="glass rounded-[20px] p-4 sm:p-5">
      <h2 id="weekend-sessions" className="mb-3 text-sm font-bold">
        {t("event.sessions")}
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {sessions.map((session) => {
          const label = sessionLabel(session.kind, t);
          const start = session.scheduled_start
            ? when.format(new Date(session.scheduled_start))
            : "";
          const body = (
            <>
              <span className="block font-bold">{label}</span>
              <span className="block text-xs text-muted">{start}</span>
              <span className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                {session.replay === "ready" ? (
                  <>
                    <Play aria-hidden="true" className="size-3.5 fill-current" />
                    {t("event.sessionReady")}
                  </>
                ) : session.replay === "pending" ? (
                  <>
                    <Loader aria-hidden="true" className="size-3.5" />
                    <span className="text-muted">{t("event.sessionPending")}</span>
                  </>
                ) : session.replay === "upcoming" ? (
                  <>
                    <Clock aria-hidden="true" className="size-3.5" />
                    <span className="text-muted">{t("event.sessionUpcoming")}</span>
                  </>
                ) : (
                  <span className="text-muted">{t("event.sessionNone")}</span>
                )}
              </span>
            </>
          );
          return (
            <li key={session.id}>
              {session.replay === "ready" ? (
                <Link
                  to={`/sessions/${String(session.id)}`}
                  className="block h-full rounded-xl border border-line px-3 py-2.5 transition hover:border-ink hover:bg-ink/5"
                >
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-xl border border-dashed border-line px-3 py-2.5">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
