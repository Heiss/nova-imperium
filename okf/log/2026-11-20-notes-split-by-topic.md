---
type: log-entry
date: 2026-11-20T05:00
kind: Docs
issues: [317]
---

#317, part 4 of the second round of the clean-up (owner, 2026-11-20): the two long notes are split by topic. `okf/architecture/patterns.md` is an index page; its 16 sections, the introduction (`why.md`) and the migration order (`migration.md`) are files in `okf/architecture/patterns/`, each keeping its section number (code and notes cite „section 7 of the design patterns“). `okf/ops/testing.md` is an index page; its decisions, the table of the kinds of tests, the code of the mutation runs, the scope, the E2E inventory and the risks are 20 files in `okf/ops/testing/`. Every note has `type`, `title` and `description`; the text of the notes is unchanged (the section heading became the heading of its file). No link pointed to an anchor of the two notes, all links point to the index pages and stay valid; the link check of the documentation website passes (117 pages).
