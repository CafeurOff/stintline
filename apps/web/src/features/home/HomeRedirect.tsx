import { Navigate } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useRaces } from "@/features/session-picker/useRaces";
import { useI18n } from "@/lib/i18n/context";

/** The app opens on the most recent race with data: the circuit is the home page. */
export function HomeRedirect() {
  const { t } = useI18n();
  const { races, isPending, isError, error, refetch } = useRaces();

  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isPending) return <Skeleton className="mt-6 h-[60vh]" />;
  const latest = races[0];
  if (!latest) {
    return (
      <EmptyState title={t("home.empty.title")}>
        <p>{t("home.empty.body")}</p>
      </EmptyState>
    );
  }
  return <Navigate to={`/sessions/${latest.sessionId}`} replace />;
}
