// Fails when src/schema.d.ts is out of date with apps/api/openapi.yaml.
// CI runs this so a schema change without regeneration breaks the build.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

// Inside the package so Prettier resolves the repository config (as `generate` does).
const dir = mkdtempSync(join(process.cwd(), ".check-"));
const fresh = join(dir, "schema.d.ts");
try {
  execFileSync(
    "pnpm",
    ["exec", "openapi-typescript", "../../apps/api/openapi.yaml", "--output", fresh],
    { stdio: "ignore" },
  );
  execFileSync("pnpm", ["exec", "prettier", "--write", fresh], { stdio: "ignore" });
  const expected = readFileSync(fresh, "utf8");
  const actual = readFileSync("src/schema.d.ts", "utf8");
  if (expected !== actual) {
    console.error(
      "packages/api-types/src/schema.d.ts is out of date. Run `make types` and commit the result.",
    );
    process.exit(1);
  }
  console.log("api-types are up to date with apps/api/openapi.yaml");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
