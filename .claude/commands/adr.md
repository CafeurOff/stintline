---
description: Create the next numbered Architecture Decision Record from the template
argument-hint: <short decision title>
---

Create an ADR titled: $ARGUMENTS

1. Find the highest number in `docs/adr/` (`NNNN-*.md`) and use the next one, zero-padded to 4 digits. The slug is kebab-case from the title.
2. Copy `docs/adr/0000-template.md`, fill in every section (context, decision drivers, options considered with pros and cons, decision, consequences) and set `Status: Accepted` and today's date. Ask me if the decision or alternatives are unclear: do not invent rationale.
3. Keep it short (under ~80 lines). Link related ADRs and docs.
4. Add the ADR to the index in `docs/adr/README.md`.
5. Update `CLAUDE.md` if the decision changes architecture, commands, conventions or pitfalls.
6. Suggest the commit message: `docs: add ADR NNNN <title>`.
