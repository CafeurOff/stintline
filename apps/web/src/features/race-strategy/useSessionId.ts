import { useParams } from "react-router";

/** Session id from the route, or `null` when the segment is not a positive integer. */
export function useSessionId(): number | null {
  const { sessionId } = useParams();
  return sessionId && /^\d+$/.test(sessionId) ? Number(sessionId) : null;
}

/** For views rendered inside `SessionLayout`, which has already validated the id. */
export function useRequiredSessionId(): number {
  const id = useSessionId();
  if (id === null) throw new Error("useRequiredSessionId used outside a session route");
  return id;
}
