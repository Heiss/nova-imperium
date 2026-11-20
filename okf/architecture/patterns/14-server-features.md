---
type: Architecture
title: '14. Server features register themselves'
description: 'A server module exports its actions and its part of the state as serverFeature; dispatch.ts and state.ts name no feature (#326).'
---

# 14. Server features register themselves (#326, part 2 of #317)

* **[E]** Decided by the owner (2026-11-19, #317): the action table of
  `src/server/game/dispatch.ts` and the state of `src/server/game/state.ts`
  stop being edited by every feature; a feature registers itself like a round
  setting (#310) and a client feature (#322). No change of the game, of a
  text, of an action name or of the JSON the client receives.
* **[V]** Contract (main agent's proposal, the owner decided only that the
  pattern comes): a server module that adds actions or a part of the state
  exports under the fixed name `serverFeature`, `export const serverFeature =
  { actions, guildActions, adminActions, state } satisfies ServerFeature;`,
  all four members optional. `ServerFeature` and `StatePart` are in
  `src/server/game/feature.ts`. The module lives next to the server code of
  the feature (`src/server/game/<feature>.ts`, as the round settings live in
  `src/core`), not in a new folder.
  * `actions` maps an action name to its `Action`; `guildActions` the same for
    the actions that are refused while guilds are off in the round (#191);
    `adminActions` the same for the actions of the admin, which are audited as
    `admin.write` and not as `game`. A name is in exactly one of the three.
  * `state` is one `StatePart`: `order` (a number, the next free ten above the
    highest; it fixes the place of the keys in the JSON object, so every
    snapshot stays), `keys` (the keys it adds, so a key defined twice is
    found at the start) and `build(ctx, user, view)`, which returns an object
    with exactly these keys. `view` holds what `stateFor` computes once for
    all parts (the round rules, the main planet, the shown planet, the
    points, the activity limits).
* **[V]** The list is generated: `scripts/gen-features.ts` writes
  `src/server/features.gen.ts` (`SERVER_FEATURES`, `[name, serverFeature]`
  pairs sorted by path), not checked in (`.gitignore`), from every file of
  `src/server` that exports `serverFeature` (same detection as for
  `roundSettings`). It is not in `src/server/game/` because
  `src/server/push-options.ts` registers too. Only `src/server` imports it:
  `client-not-server`, `core-stays-pure` and `feature-stays-pure` forbid every
  other part of the code to reach `src/server`, so the browser bundle cannot
  contain it. Knip takes it as an entry; Vitest coverage and Stryker leave it
  out.
* **[V]** `dispatch.ts` and `state.ts` keep their frame: the general gates of
  `runAction` (vacation, guilds, admin audit category, achievements) and the
  actions and state keys of the core game. The functions of
  `src/server/game/assemble.ts` build `ACTIONS`, `GUILD_ACTIONS` and
  `ADMIN_ACTIONS` from the frame and the list and the ordered parts of the
  state; a name, a key or an order number that exists twice stops the start
  with both files named. The guard test `src/server/game/registry.test.ts`
  checks the rules for every listed module.
* **[V]** Built: these modules register `actions`, `guildActions` or
  `adminActions` (`demolition`, `endzeit`, `admin`, `phalanx`, `missiles`,
  `jump-gate`, `main-planet`, `vacation`, `abandon`, `market`,
  `fleet-actions`, `push-options`, `friends`, `achievements`, `guilds`,
  `guild-ranks`, `guild-chat`) and these a part of the state (`main-planet`
  60, `jump-gate` 80, `guilds` 110, `friends` 120, `achievements` 130,
  `abandon` 170 for the locks, `market` 180, and `admin-state` 190, a module
  of its own because the Endzeit imports `admin.ts`, then `quick-targets` 200
  for the Schnellwahl of the fleet form, #292). The frame keys of
  `state.ts` have numbers too (10 to 160, ten apart, with the gaps the
  features use), so the JSON keys stay in their old order; a new part takes
  the next free ten above the highest. Left in the frame on purpose: the
  actions `build`, `cancelBuild`, `research`, `cancelResearch`, `order`,
  `pct`, `rename`, `options`, `read`, `delrep` and `delall` of
  `actions.ts` (the core game and the account; `actions.test.ts` calls them
  directly), the general gates of `runAction`, `lockedState` (the lock screen
  of the vacation mode has its own, shorter shape), `meOf` (the account, with
  its push kinds and its vacation) and the keys `round`, `now`, `cfg`, `me`,
  `planet`, `labs`, `fleets`, `reports`, `players`, `galaxy` and `debris`.
  `src/server/game/registry-pin.test.ts` wrote out every action with its
  group and the key order of the state once for the refactoring; it is
  deleted (#317), the guard `registry.test.ts` keeps the rules and no list
  has to be edited when an action or a key is added.
* **[V]** The state type of the browser (`GameState` in
  `src/client/logic/types.ts`) is not composed from per-feature types: the
  types of the parts live in the client, `client-not-server` forbids a type
  import from the server too, so it would mean moving them into `src/core`,
  which is not mechanical. It stays one hand-written interface.
