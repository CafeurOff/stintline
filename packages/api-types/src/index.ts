/**
 * Public entry point of the generated API types.
 * `schema.d.ts` is produced by `pnpm --filter @stintline/api-types generate`.
 */
import type { components, operations, paths } from "./schema";

export type { components, operations, paths };

/** Shorthand for a named schema component, e.g. `Schema<"Health">`. */
export type Schema<Name extends keyof components["schemas"]> = components["schemas"][Name];
