---
type: log-entry
date: 2026-11-21T13:00
kind: Decision and code
issues: [335, 231, 235]
---

#335 (owner, 2026-11-21, [E]), a follow-up of #231 and #235. „Spielaktionen“ of the box „Meine Aktivität“ counts the actions that change something, plus the reads the player starts on purpose by a click; a read a view makes by itself does not count. `ACTION_KIND` of `src/core/action-kind.ts` gives every action one class and is typed `Record<ActionName, ActionKind>`, so a new action without a class is a type error (guard test against the declared actions). Classes: change (counted: every action not named below), click (counted: `roundReport`, `roundRewind`, `roundParticipant`, `scan`), view (not counted: `roundArchive`, `roundHistory`); the automatic writes `read` and `seeGuildChat` are not counted either, [V] in a class of their own, `auto`. `countsAsPlayAction` is used by `journalActions` and by `auditActions` of `src/server/game/playtime.ts`: a day before the journal applies the same table to the audit rows (an unknown name and the rejected rows of `rateLimit` do not count) and keeps the larger of the two counts; `dayTable` and so the admin diagnostics follow. One build plus opening „Hilfe“ now counts 1, not 3 (E2E case of `e2e/playtime.spec.ts`). The admin's counters `actions` and `recentActions` stay raw counts of the audit log, reads included ([V]). A new changelog fragment `changes/spielaktionen.md` ([V] wording); the fragment of #231 belongs to the release 26.11.23 and is not changed.
