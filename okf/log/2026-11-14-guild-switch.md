---
type: log-entry
date: 2026-11-14
kind: Code
issues: [191, 169]
---

#191 built with the owner's decisions of 2026-11-14 (issue and comment „Geklärt“): one checkbox „Gilden (mit Chat)“ in the dialog „Neue Runde“, preselected with the current round and changed only there; a round with guilds off deletes every guild with its members, applications and ranks (`guilds.deleteAll()`), hides „Gilden“ and the mark for applications, and the server refuses every guild action with „Gilden sind in dieser Runde abgeschaltet.“ (`GUILD_ACTIONS` and `requireGuilds` in `runAction`); existing universes start with guilds on; the choice is in the round-reset audit entry; the switch is the settings key `roundGuilds`, no migration; `roundRules(ctx).guilds` is the single source the chat of #169 reads; four details the issue leaves open are O14 (see [Guilds on or off per round](/features/guild-switch.md), [Admin](/features/admin.md), [SQLite storage](/data/sqlite.md)).
