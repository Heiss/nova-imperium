---
type: log-entry
date: 2026-11-27T17:00
kind: Code
issues: [426, 163, 169]
---

#426 part 5 built with the owner's decisions of 2026-11-26 (192a, 193b) and the coordinator's choices of 2026-11-27 [V]: the rights of the guild ranks register themselves like the push kinds. `src/core/guild-rights/management.ts` (the rights of #163) and `chat.ts` (the rights of the guild chat, #169) export `guildRights`, entries of key, order, name and, for reading and writing in the chat, `member`; `scripts/gen-features.ts` writes `guild-rights/rights.gen.ts`, and `src/core/guild-ranks.ts` derives `GUILD_RIGHTS`, the type `GuildRight`, `RIGHT_TEXT` and `MEMBER_RIGHTS` from it, names no right, and stops the start at a key or an order defined twice. The names were moved unchanged; the lists and the rules over all pairs of rights were compared before and after, byte for byte, and the guild tests run unchanged. The CHECK of `guild_rank_rights.right_key` stays in the migrations (192a): a new test migrates an in-memory database, reads the CHECK from it and fails, naming both lists, when they hold different rights, so a new right needs a new migration (shown with a right added for the test only).
