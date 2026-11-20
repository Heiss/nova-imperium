---
type: Architecture
title: '15. Repositories and the round reset register themselves'
description: 'A repository exports repository, the tables a new round empties or keeps are declared as roundReset next to their owner; no shared list names a feature (#317).'
---

# 15. Repositories and the round reset register themselves (#317)

* **[E]** Decided by the owner (2026-11-20, #317): `src/server/db/repos/index.ts`,
  its test and the `DELETE` lines of `newRound` in `src/server/game/admin.ts`
  name no feature any more.
* **[V]** Repositories (main agent's proposal): a module in
  `src/server/db/repos/` exports `repository = { key, make } as const
  satisfies RepositoryModule` (`contract.ts`). `key` is the name on `Ctx`
  (`ctx.market`), `make(db)` builds the repository and its return type is the
  type of `ctx.<key>`: the interface, not the class (the classes are no longer
  exported). `scripts/gen-features.ts` writes the git-ignored
  `repositories.gen.ts` (`REPOSITORIES`, `[file, repository]` pairs); the type
  `Repositories` is derived from it, so every repository keeps its type
  without a line in a shared file. `assembleRepositories` (`index.ts`) throws
  when a key exists twice, naming both files; the guard is
  `src/server/db/repos/index.test.ts`.
* **[V]** The round reset: a file of `src/server` that owns tables exports
  `roundReset`, a list of steps (`src/server/db/round-reset.ts`):
  `{ order, clears: [tables], when? }` empties the tables with `DELETE FROM`
  in the order of the numbers (a table whose parent deletes it by cascade
  needs no entry; the referring table comes first where there is no cascade),
  and `{ keeps: [tables], when? }` says that a new round leaves them on
  purpose (accounts, settings, the round archive, the buddy list, the
  playtime). `when` takes the rules of the new round (the guilds are emptied
  only in a round with guilds off). The list is `src/server/round-reset.gen.ts`
  (`ROUND_RESETS`); `newRound` calls `clearRound(ctx.db, rules, ROUND_RESETS)`
  and keeps only what is not a table of a feature: the player loop (research,
  main planet, vacation, reports of the player, the new home planet).
  `src/server/db/round-reset.test.ts` checks the rules (a number or a table
  twice, a name that is no table of the schema);
  `src/server/game/round-reset.test.ts` writes one marked row into every table
  of the schema and runs a reset: the row of a table that is neither emptied
  nor declared as kept survives and fails the test, so a new table cannot be
  forgotten and no list has to be edited.
* **[V]** The orders are the ones of the old code, ten apart: planets 10,
  guilds 20 (guilds off) and their chats 30, fleets 40, debris 50, last
  targets 60, surveys 70, market 80, push jobs 90, attack union invites 100,
  achievements 110.
