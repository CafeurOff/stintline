import type { Schema } from "@stintline/api-types";

type Problem = Schema<"Problem">;

/** Error raised by query functions. `message` is safe to show: it comes from the API problem. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isProblem(value: unknown): value is Problem {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    "status" in value &&
    typeof value.title === "string" &&
    typeof value.status === "number"
  );
}

/**
 * Returns `data` from an openapi-fetch result, or throws an `ApiError` built from the
 * RFC 7807 problem body. Throttling gets a friendlier message.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  const { status } = result.response;
  if (status === 429) {
    throw new ApiError(status, "throttled", "Too many simulations in a short time. Try again.");
  }
  if (isProblem(result.error)) {
    const detail = typeof result.error.detail === "string" ? result.error.detail : "";
    const message = detail && detail !== result.error.title ? detail : result.error.title;
    throw new ApiError(status, result.error.code, message);
  }
  throw new ApiError(status, "unexpected", "The API returned an unexpected response.");
}

/** User-facing message for any error a query can raise. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not reach the API.";
}
