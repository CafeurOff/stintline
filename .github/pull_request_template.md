## Summary
<!-- What does this change and why? Link the issue: Closes #123 -->

## Changes
-

## How to verify
```bash
make check
```
<!-- Plus manual steps or screenshots for UI changes -->

## Checklist
- [ ] Conventional Commit messages, small focused commits
- [ ] Tests added or updated, no network access in tests
- [ ] Coverage gates hold (strategy ≥ 90 %, racedata ≥ 85 %, api ≥ 80 %)
- [ ] `make types` run if the API changed (schema + `packages/api-types` committed)
- [ ] Docs / `CLAUDE.md` / ADR updated if behaviour, architecture or assumptions changed
- [ ] Strategy model changes: `docs/model.md` and backtest results updated
- [ ] UI changes: keyboard navigation and AA contrast checked, loading/empty/error states present
- [ ] No logos or official imagery, no secrets
