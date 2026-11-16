---
type: log-entry
date: 2026-11-16T18:10
kind: Code
issues: [241, 118, 209, 251]
---

#241 built: the header names the active planet once; with more than one own place only the list „Aktiver Planet“ shows it, now first, then „Kommandant … · Logout“; with one planet its name and position stay as text; D1 (the list first) and D2 (the same on a phone) taken as recommended [V]; `Header.svelte` changed, `headerLine()` of #118 unchanged; the frozen header of `src/test/frame-reference.test.ts` got this one change, marked, as #209 did for its energy; unit tests for one place and several, which failed before; new `e2e/header.spec.ts` (desktop and phone, axe on the header); the E2E tests read the active place of several from the entry the rendered header marks `selected`, which only the applied state sets, not a choice in the list (`expectShownPlace()`, CodeRabbit on #251); changelog fragment `changes/kopfzeile-aktiver-planet.md` (see [Interface](/features/interface.md), [Design patterns](/architecture/patterns.md)).
