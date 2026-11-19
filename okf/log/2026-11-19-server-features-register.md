---
type: log-entry
date: 2026-11-19T18:00
kind: Code
issues: [326, 317]
---

#326, part 2 of the clean-up #317, without a change of the game, of a text, of an action name or of the JSON the client receives: server features register themselves. A server module exports `serverFeature` with `actions`, `guildActions`, `adminActions` and a part of the state (`order`, `keys`, `build`); `scripts/gen-features.ts` lists the modules in the git-ignored `src/server/features.gen.ts`, and `dispatch.ts` and `state.ts` build `ACTIONS`, `GUILD_ACTIONS`, `ADMIN_ACTIONS` and the state from their frame and that list (`assembleActions`, `assembleState`; a name, a key or an order number defined twice stops the start with both files named). [V] The contract (`src/server/game/feature.ts`) is the main agent's proposal; the list is in `src/server` and not in `src/server/game` because `push-options.ts` registers too. The actions of 17 modules and the state parts of 8 (the main planet, the gates, the guilds, the friends, the achievements, the locks, the market and the admin, now in `admin-state.ts`) moved; the numbers of the state keys fix their old order. What stays in the frame: the core actions of `actions.ts`, the general gates of `runAction`, `lockedState` and the keys that belong to no feature. The guard test `src/server/game/registry.test.ts` checks the rules for all modules, `registry-pin.test.ts` pins the actions with their groups and the key order of the state; the client's state type `GameState` stays one interface.
