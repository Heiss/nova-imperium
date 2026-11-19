---
type: log-entry
date: 2026-11-19T21:00
kind: Feature
issues: [235, 231, 232, 237]
---

Two follow-ups of features built earlier today. The play time in the round archive (#235 with #231 and #232): the close of a round writes one event `player.playtime` per participant (the accepted intervals of the round, merged, cut at the cutoff, no page, session or account), the report derives the sum on read and shows it as a column to every reader of a finished round (D2), a provisional report and an archive from before this change show none; `playtime_events` is kept at the close and deleted with the round [V]. The open view parts of the planet limit (#237): the line of the research row and, in „Neue Runde“, the fields of the research only with the research on and the preview line [V, texts]. Then the owner's „Geklärt“ of 2026-11-19: the default of the planet limit is 6 for new rounds and unlimited for the running round (`def` and `unstored` on the registry entry, no migration, the dialog offers the 6 through the admin state) and the cost of the Kolonialverwaltung is [E] as built (#237); a page stores at most one row per heartbeat interval, enforced in `judge` without losing an honest report, with the number of pages and alternating start and stop floods left open for the owner (#232). See [Round archive](/features/round-archive.md), [Own activity](/features/own-activity.md) and [Colonization](/features/colonization.md).
