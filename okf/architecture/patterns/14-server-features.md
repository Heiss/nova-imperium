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
  { actions, adminActions, state, enabled, off } satisfies ServerFeature;`,
  all members optional (`off` is required with `enabled`). `ServerFeature` and `StatePart` are in
  `src/server/game/feature.ts`. The module lives next to the server code of
  the feature (`src/server/game/<feature>.ts`, as the round settings live in
  `src/core`), not in a new folder.
  * `actions` maps an action name to its `Action`; `adminActions` the same
    for the actions of the admin, which are audited as `admin.write` and not
    as `game`. A name is in exactly one of the two.
  * **[E]** A feature says whether it is on in the round (#374; owner,
    2026-11-22, #351: a refactor of the v3 foundation without a change of
    behaviour). **[V]** `enabled(round)` with its refusal `off`: while it is
    off, `runAction` refuses each of its actions with `off` and every key of
    its `state` part is null (`assembleState` wraps its `build`). Guilds,
    their ranks and their chat (`guilds`, `guild-ranks`, `guild-chat`) say
    `enabled: (round) => round.guilds, off: GUILDS_OFF` instead of the former
    group `guildActions` (#191); the marketplace keeps its own switch in its
    own code. `GUILD_ACTIONS` of `dispatch.ts` is read from the switches (the
    actions refused with `GUILDS_OFF`). The admin's guild chat
    (`adminGuildChat`, an HTTP route, not an action) keeps `requireGuilds`,
    and the Schnellwahl leaves the guild targets out by `round.guilds`
    (#292): neither refuses an action or leaves out a state part. The group
    cases of `registry.test.ts` became cases of the switch, at least as
    strict (coordinator, 2026-11-24, [V]).
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
  `runAction` (vacation, the switch of a feature, admin audit category, achievements) and the
  actions and state keys of the core game. The functions of
  `src/server/game/assemble.ts` build `ACTIONS`, the switches of the actions
  and `ADMIN_ACTIONS` from the frame and the list and the ordered parts of the
  state; a name, a key or an order number that exists twice stops the start
  with both files named. The guard test `src/server/game/registry.test.ts`
  checks the rules for every listed module.
* **[V]** Built: these modules register `actions` or `adminActions` (`demolition`, `endzeit`, `admin`, `phalanx`, `missiles`,
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
* **[E]** Decided by the owner (2026-11-20, #317, #118, „jetzt komplett“): the
  boundary between the browser and the server is checked by the compiler, for
  the actions and for the state. No game rule, text, value or wire format
  changes; the validation of the server stays as it is (types do not replace
  it: the input arrives as JSON and every handler still checks what it reads).
* **[V]** The actions: `src/core/actions/<feature>.ts` declares the input of
  each action, `export const actionInputs = { name: input<{ ... }>() }`
  (`input` and `Attr`, the type of a `data-*` attribute, are in
  `src/core/action-input.ts`). The files are listed in the git-ignored
  `src/core/actions.gen.ts` (`scripts/gen-features.ts`, the same detection as
  for `roundSettings`), so a new action edits no shared list; `src/core/
  actions.ts` merges them into the type `ActionMap` and offers `ActionName`
  and `Wire<K>`, the input plus the `planet` the browser's transport adds to
  every call. A field the browser reads from a `data-*` attribute is `Attr`
  (a text or nothing); a field the server accepts leaves out (`cargo`, `pct`
  of `send`) is optional, because the map says what the server accepts and
  the browser's form is a subtype of it.
* **[V]** The server side: a handler is declared `Handler<'name'>`
  (`src/server/game/actions.ts`), so its `d` is the input of the map, and the
  members `actions` and `adminActions` of `ServerFeature` are
  `Handlers`, a mapped type over the names of the map: a name the map does not
  know, or a handler of another action, is a compile error. The table of
  `dispatch.ts` erases the type in `assembleActions` (one cast, there). The
  guard `src/server/game/action-contract.test.ts` checks at run time that the
  names the server registers are exactly the names the map declares, each
  once, and at compile time that every handler declares exactly the input of
  its name (a handler typed with the wide `Data` fails there). Tests that send
  junk on purpose use `loose<'name'>(...)` of `test-helpers.ts`.
* **[V]** The state: `src/core/state/<part>.ts` exports `type StateShape`, the
  keys one part holds and their types (the frame of `state.ts` in `frame.ts`);
  the files are listed in `src/core/state.gen.ts` (`FullState`, the
  intersection), and `src/core/state.ts` derives `GameState` from it: the keys
  of the lock screen of the vacation mode (`LockedState`) always, every key of
  a feature as optional, as the lock screen does not send them. A feature
  declares `state: { ... } satisfies StatePart<StateShape>`, a key of the frame
  goes through `keyed` of `state.ts`, which takes the type from `frame.ts`; so
  what the server builds is checked against the type the browser reads, and
  `src/server/game/state-contract.test.ts` checks that every key of a feature
  has a shape and every shape a sender. `client/logic/types.ts` only
  re-exports.
* **[V]** Where the hand-written `GameState` differed from what the server
  sends: `GuildChatMessage.arrival` is `number | null` (the column is
  nullable; only an attack carries it), the browser treated it as `number |
  undefined` and would have shown 1970 for an attack row without a time;
  `logic/guilds.ts` now treats `null` like a missing time. `AdminState.specs`
  is `readonly`. Nothing else differed.
