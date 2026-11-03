import type { paths } from "@stintline/api-types";
import createClient from "openapi-fetch";

/**
 * Typed API client. Paths, params and bodies are checked against the OpenAPI schema
 * through `@stintline/api-types`. Requests are same-origin (`/api/...`): Vite proxies
 * them in development and nginx in production.
 *
 * `fetch` is resolved at call time (not captured at import) so test interceptors and
 * polyfills installed later are honoured. The origin makes URLs absolute for runtimes
 * whose `Request` rejects relative URLs.
 */
export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  fetch: (request) => globalThis.fetch(request),
});
