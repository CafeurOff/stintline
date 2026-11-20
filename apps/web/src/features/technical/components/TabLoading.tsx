import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ApiError } from "@/lib/errors";

/** A tab's query states: skeleton, error with retry, or the empty message on a 404. */
export function TabLoading<T>({
  query,
  empty,
  children,
}: {
  query: { data: T | undefined; error: unknown; isError: boolean; refetch: () => unknown };
  empty: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.error instanceof ApiError && query.error.status === 404) {
    return <EmptyState title={empty} />;
  }
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <Skeleton className="h-[60vh]" />;
  return <>{children(query.data)}</>;
}
