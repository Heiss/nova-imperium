---
type: log-entry
date: 2026-11-14
kind: Code
issues: [163, 160]
---

#163 built with the owner's decisions of 2026-11-13 („Geklärt“, „Geklärt, Ergänzung“): guild ranks with the rights Bewerbungen, Mitglieder entfernen, Ränge vergeben, Profil ändern and Ränge verwalten (the marker right waits for #160, which is not built); exactly one Leitung with every right; only the Leitung hands over the Leitung, chooses the default rank and dissolves the guild; ranks ordered, a member acts only on lower ranks and gives only rights it holds; at most 25 ranks, names of at most 67 characters (minimum 2 proposed); ranks only inside the guild, the public page no longer names the Leitung; migration 17 (`guild_ranks`, `guild_rank_rights`, `guilds.default_rank`, `guild_members.rank_id`; existing members „Mitglied“, the founder the Leitung); `src/server/game/guild-ranks.ts` is a security file; proposals and five open questions in [Guild ranks](/features/guild-ranks.md) (see [SQLite storage](/data/sqlite.md), [Test strategy](/ops/testing.md)).
