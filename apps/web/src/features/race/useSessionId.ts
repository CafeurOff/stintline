import { useParams } from "react-router";

/** Session id from the route, or `null` when the segment is not a positive integer. */
export function useSessionId(): number | null {
  const { sessionId } = useParams();
  return sessionId && /^\d+$/.test(sessionId) ? Number(sessionId) : null;
}
