---
description: Record a real upstream API response as a sanitised test fixture
argument-hint: <openf1|jolpica|livetiming> <endpoint> <params as key=value...>
---

Record a fixture: $ARGUMENTS

This is the only workflow where network access is expected, and it happens through the project's recorder, never in tests.

1. Check the target does not already exist under `packages/racedata/fixtures/<provider>/`.
2. Run the recorder: `uv run python -m racedata.tools.record_fixture <provider> <endpoint> <params...>`. It goes through the rate-limited `racedata` HTTP client and writes
   `packages/racedata/fixtures/<provider>/<path>/<params>.json` together with a `.meta.json` file (URL, params, recorded_at UTC, size, sha256, dropped fields).
3. **Keep it small.** If the payload is over ~500 KB, propose a narrower query (filter by `driver_number`, `lap_number` range, or a date window) before saving. Never record `car_data` or `location` for a full session.
4. **Sanitise.** Make sure there are no tokens, cookies or personal data. Strip URLs pointing at official media assets (`headshot_url`) by replacing them with `null`.
5. Add or extend a parsing test that loads the fixture through the provider adapter and asserts on the DTOs produced (counts, a few known values, handling of nulls).
6. List the fixture in the table in `docs/data-sources.md` (fixture inventory) with its source and terms.
7. Live timing (`livetiming`) fixtures come from local recordings only, are trimmed to the minimum needed, and must respect the personal-use note in ADR 0002.
