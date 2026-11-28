---
type: Architecture
title: '7. Server actions: commands'
description: 'Server actions as commands, their checks in pure functions of the core, and what the browser repeats.'
---

# 7. Server actions: commands

* **[E]** The command map `ACTIONS` (`src/server/game/dispatch.ts`) stays.
  Every check of an action is a pure function in `src/core` that returns an
  error code; server and browser turn it into the German message (as
  `yard.ts`, `lab.ts` already do).
* **[V]** Built with #53 (second pull request): an action may answer data
  besides its message, `{ msg, data }` (`Answer`, `answerOf` in
  `src/server/game/actions.ts`); `POST /api/action` adds `data` to the
  reply only then, and the client's `act()` hands it to `answer` before it
  applies the state, only for the newest action of its type: the data of a
  scan that a newer scan overtook is dropped, its state still applies
  (CodeRabbit review of #217). First user: the scan of the Auspex-Phalanx, whose
  check `scanError` is a pure function of `src/core/phalanx.ts` and whose
  reach `scanReach` the Sternenkarte asks too.
* **[E]** Audited with #214 on 2026-11-15:
  [Checks of the server actions](/architecture/action-checks.md) lists the
  33 actions of `ACTIONS` with where their checks live, what the browser
  repeats and whether the messages match. 7 follow this section, 13 are
  split between `src/core` and the server, 13 check inline only; 17
  findings where browser and server disagree. **[V]** The follow-up pull
  requests, one per group (economy, fleet, rewards, admin, player, guild),
  are planned there.
* **[E]** Economy group built (#214, 2026-11-16): `buildErrors`,
  `researchErrors`, `orderErrors` and `isProducer` in
  `src/core/economy-checks.ts` return every code that applies; the server
  refuses with the message of the first, the lists of the browser show the
  note of the first in their order. Build and research check in one order
  on both sides, and an order of 0 gets the browser's text on the server
  too (O18 (c): F8, F9, F10).
* **[E]** The other groups built (#214, 2026-11-21): admin, guild,
  player, rewards and fleet; every action of the audit follows this
  section, `send` but for the joining of an attack union (#225). F12 and
  F15 unified (owner), F18 built: the list of requirements asks
  `buildErrors` and `researchErrors`
  ([Checks of the server actions](/architecture/action-checks.md)).

* **[V]** Built with #283 (a refactor without a visible change, in the
  style of #111): the settings of a round are a registry, `ROUND_SETTINGS`
  in `src/core/round.ts`, instead of hand wiring in `RoundRules`,
  `roundRules()`, `startRoundRules()`, `UNIVERSE_SPECS`, the dialog „Neue
  Runde“, the client's `doReset` and the reset action. Each entry gives
  its stored key, its name, its German label, its range or choices, its
  default and its refusal (else the shared range wording `rangeError` of
  the universe settings); the pure checks `roundRefused` and `roundValues`
  are in the core, the server words the refusal. `RoundRules` is derived
  from the entries' types. A feature defines its entries in its own file
  and exports them as `roundSettings`; the list of all of them is
  generated like the feature index (`src/core/round-settings.gen.ts`,
  `scripts/gen-features.ts`, #310), so `src/core/round.ts` names no feature
  and a new feature edits no shared place and no test of another feature;
  its `order` number, the next free ten above the highest, puts it last in
  the fixed order of the dialog and the refusals (owner, 2026-11-17; a test
  refuses a number used twice); `live: true` also puts it into the universe
  settings (X1). The rules are in
  [Admin](/features/admin.md#the-registry-of-the-round-settings-283).

## A repeated action runs once (#450)

* **[E]** The server ensures by itself that a repeated action runs only
  once, in its own issue on `main`, with #408 (v3) building on it (owner,
  2026-11-27, 292a). The locks in the browser (#425, #428) stay.
* **[V]** The key: `createApi` (`src/client/logic/transport.ts`) makes one
  key per call with a body, `crypto.randomUUID()`, and sends it in the header
  `Idempotency-Key`, the same on its own resend after a busy database. A
  header, not a body field, because actions have a body field `key` of their
  own (`pct`, `tearDownMissiles`).
* **[V]** The check: `once` of `src/server/http/action-keys.ts`, keyed by the
  player, the route and the key (the same key on two routes runs on both),
  after the session and before the handler, wraps
  `POST /api/action` (game, guild and admin actions) and the admin writes
  (`/api/admin/{invite, revoke, announce, moderate, moon, bot-check,
  totp-reset}`). Sign-in, registration, passkeys, passwords, push, reports
  and deleting the account are not wrapped; they ignore the key the browser
  sends with them.
* **[V]** Kept in memory per player for 60 s from the end of the run, at
  most 240 keys per player (twice the 120 actions of a minute, room for the
  admin writes; the oldest finished key goes first, a run in progress is
  never dropped). Every request with a key first drops the keys past their
  time and the players left without one, of every player; a restart forgets
  them. An answer is kept without its `state`, which a repeat builds anew.
  Kept are only final outcomes: an answer below 500 or a
  refusal of the game. The refusal of the limit of actions („Zu viele
  Aktionen …“) is a refusal of the game too, so a repeat of its key gets it
  again (by design). A busy database (503 `ACTION_DB_BUSY`), a server
  error, a missing session and every other failure are forgotten, so a
  resend runs again.
* **[V]** A repeat gets the outcome of the first run, an answer with a
  `state` with the state of now (`freshState`); it runs no handler, writes
  no audit entry, records no activity and is not counted against the limit
  of actions. A repeat of a run still in progress (the invitation awaits its
  mail) waits for it.
* **[V]** A request without a key, or with an invalid one (not 1 to 64
  letters, digits or dashes), runs as before, the transition until the key
  is required (#408). No new German text: a repeat shows the answer of the
  first.
