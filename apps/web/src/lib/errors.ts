import type { Schema } from "@stintline/api-types";

import type { MessageKey } from "./i18n/en";

type Problem = Schema<"Problem">;

/** Error raised by query functions, carrying the HTTP status and the API problem. */
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

/** Returns `data` from an openapi-fetch result, or throws an `ApiError`. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data !== undefined) return result.data;
  const { status } = result.response;
  if (status === 429) throw new ApiError(status, "throttled", "");
  if (isProblem(result.error)) {
    const detail = typeof result.error.detail === "string" ? result.error.detail : "";
    const message = detail && detail !== result.error.title ? detail : result.error.title;
    throw new ApiError(status, result.error.code, message);
  }
  throw new ApiError(status, "unexpected", "");
}

type Translate = (key: MessageKey) => string;

/**
 * User-facing message. Throttling and network failures are translated; other API
 * problems keep the server's safe detail (it never contains internals).
 */
export function errorMessage(error: unknown, t: Translate): string {
  if (error instanceof ApiError) {
    if (error.code === "throttled") return t("error.throttled");
    return error.message || t("error.unexpected");
  }
  return t("error.network");
}
