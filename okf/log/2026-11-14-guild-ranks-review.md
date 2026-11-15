---
type: log-entry
date: 2026-11-14
kind: Decision
issues: [197]
---

review of #197 (owner, 2026-11-14): a rank is given only when the actor holds every right of that rank; a rank with members is deleted only when the default rank, where they move, is strictly below the actor and holds no right the actor lacks (the Leitung may always delete, a rank without members goes freely); a disabled box of a right shows the server's state after a refresh, only editable boxes keep a draft; the pure rank rules (order, names, rights, default rank, giving and deleting) moved to `src/core/guild-ranks.ts` as plain functions, used by the server and the guild view; `guilds.rankHasMembers` added (see [Guild ranks](/features/guild-ranks.md)).
