---
type: Architecture
title: '4. Missions: one strategy per mission'
description: 'Every mission is a folder with its rules, its name and its arrival, so a new mission adds files and no condition in a shared one.'
---

# 4. Missions: one strategy per mission

* **[E]** A mission is a file with `canSend(fleet, target)` (pure, in
  `src/core`, used by server and browser) and `onArrive(ctx, fleet)`
  (server only). A registry replaces the `if` chain in
  `src/server/game/arrival.ts`.
* **[E]** Decided for #116 (owner, 2026-11-14):
  * Form: each `src/features/missions/<m>/rules.ts` exports `canSend` and
    typed data: the order, the target kind (own, foreign, any, free), cargo
    yes or no, return yes or no, ships visible to the defender yes or no,
    silent return yes or no. Data, no free hooks. **[V]** #169 adds one
    more typed field, `alertsGuild` (whether the launch writes an event
    into the chat of the defender's guild; the attack only), so the server
    asks the rules, not the mission's name.
  * Send check: `canSend` returns an error code or nothing. The server
    determines the noob protection and turns the codes into today's German
    messages, in today's order. Slots, cargo and fuel stay generic. The
    fleet form keeps offering every mission (replaces the [V] of #116 that
    the fleet view offers only what `canSend` allows).
  * Arrival: the dispatcher in the server's arrival code checks generically
    through the target kind whether the target still fits, else „Flotte
    kehrt um“. Colonize gets the raw target, the others the settled target,
    in today's order and with the same random draws.
  * Order: an `order` field in each `rules.ts`, in steps of 10; order and
    preselection of the fleet form stay (attack, transport, spy, colonize,
    deploy; the first preselected).
  * Server registry: `gen-features` also writes
    `src/features/index.server.gen.ts` (`MISSION_SERVERS`), not checked in;
    every mission needs an `arrive.server.ts`; only `src/server` imports
    that index (dependency-cruiser).
  * Type `Mission`: a type-only derivation from the generated index, if the
    rule `no-circular` allows it (else the question comes back).
  * Texts: see section 2.
* **[E]** Built with #116: five folders `attack`, `transport`, `spy`,
  `colonize`, `deploy`, each with `rules.ts`, `texts.de.ts`,
  `arrive.server.ts` and a test of its own `canSend` and `onArrive` (seeded
  random, fixed clock). The data: attack 10, foreign, cargo, return,
  visible; transport 20, any, cargo, return; spy 30, foreign, no cargo,
  return, silent (it comes home without a report of its own unless
  recalled); colonize 40, free, cargo, return; deploy 50, own, cargo, no
  return. Only `canSend` of spy (only Spähschädel, `probesOnly`) and of
  colonize (a Kolonistenarche, `noColonyShip`) check anything; the others
  return nothing.
  `src/core/missions.ts` holds the types (`TargetKind`, `SendError`,
  `SendFleet`, `SendTarget`, `MissionRules`), `missionRules(m)` from the
  index, `MISSION`, `suits(kind, owner, planet)` and `sendError(rules,
  fleet, target)`: first the target kind (occupied; no planet, same planet,
  not own, own target, noob protection), then the mission's `canSend`. The
  server passes the noob protection as `protects(owner)`, asked only for a
  foreign target after the other checks, so the points are computed as
  rarely as before; `fleet-actions.ts` maps each code to its message.
  `src/server/game/arrival.ts` reads `onArrive` from `MISSION_SERVERS`;
  the target fits by `suits` and, for a free target, by a position inside
  the universe (the check colonize had); a free target gets no arrival
  (`null`, nothing is there), the others `{ t, att, def }` with the settled
  planet. The coming home reads `silent`, the view of a foreign fleet
  `visible`, the cargo of a send `cargo`, the fleet form `order`, `target`
  („Freie Position“) and `returns` (no return time). `MissionServer`,
  `Arrival`, `turnBack`, `land` and `researchAt` are in
  `src/server/game/missions.ts`; `arrival.ts` still exports `spyScore`,
  `rebuild` and `plunder`, which moved to the spy and
  attack folders. A fleet of an unknown mission throws and `tick` removes
  it; the database allows only the five missions. No `f.mission ===` is
  left outside the mission folders.
* **[E]** Built with #55, within the decisions of #116: the seventh folder
  `hold` (Wache stellen, 70) with the new target kind `ally`, a foreign
  planet whose owner must be an ally: `suits` treats it as `foreign`, the
  noob protection keeps it as a foreign target, the own planet gets
  `notAlly`, and the mission's `canSend` asks the server's `ally` and
  `holding` of `SendTarget` (both optional, asked only by it). Every
  rules.ts exports the new typed field `holds`; the fleet state `hold`
  sits between `out` and `back`, and the server's clock ends it
  (`dueAt` of `src/core/holding.ts`).
* **[V]** Changed with #228 (owner, 2026-11-16, D2: the thresholds of the
  Auspex-Lehre apply to every foreign fleet): the field `visible` is gone
  from `MissionRules` and every `rules.ts`; the view of a foreign fleet
  asks `seenShips()` of `src/core/fleet-recognition.ts` instead (see
  [Espionage defense](/features/espionage-defense.md)).
* **[E]** Built with #45, within the decisions of #116: the sixth folder
  `harvest` (Bergung, 60) with the target kind `debris` beside own,
  foreign, any and free. `SendTarget` carries `debris` (a Trümmerfeld lies
  at the position); `sendError` checks only that for the kind `debris`
  (`noDebris`), whatever planet is there, then `canSend` (`noRecycler`).
  `suits` takes the field as a fourth argument. A fleet of the kind
  `debris` flies to the place `d<g>_<s>_<p>`; at the arrival the dispatcher
  turns it back when the field is gone, with the text of #45, and else
  hands it no arrival (`null`), like a free target, because a field is no
  planet. Migration 16 allows `harvest` in the database
  (see [Trümmerfelder](/features/debris.md)).
* **[E]** Built with #95, within the decisions of #116: the seventh folder
  `moonbreak` (Mondbruch, 70) with the target kind `foreignMoon`, a foreign
  moon and nothing else, so the kind alone says what the mission fits (as
  #253 needs for its filter, „the moon's target kind decides“). `sendError`
  answers `notMoon` when the fleet does not fly to a moon, then checks it as
  a foreign target (no moon, same place, own target, noob protection), then
  `canSend` (`noWorldbreaker`). `suits` reads the kind of the place, so at
  the arrival a target that has become a planet does not fit and the fleet
  turns back with „Flotte kehrt um“. Its arrival reuses the steps of the
  attack, moved from `attack/arrive.server.ts` into
  `src/server/game/fight.ts`, because a feature folder never imports
  another (dependency-cruiser): `fight`, `battleReports` with what a
  mission adds to each side's report, `flyHome`, and `rebuild` and
  `plunder`, which the attack folder re-exports; the attack runs them in
  the same order and with the same draws as before. Migration `20261119T0810-moonbreak` allows `moonbreak`
  in the database (see [Moons](/features/moons.md)).

* **[V]** Built with #237, #253 and #292, within the decisions of #116:
  `sendError` is `fitError` (the target kind, which asks nothing of the
  ships; the fleet form lists only the missions for which it finds nothing,
  `missionsFor` of `src/core/mission-fit.ts`) and then the mission's
  `canSend`. Two optional typed fields of `MissionRules` mark missions without
  naming them: `colonizes` (the Landnahme, counted against the planet limit)
  and `remembered` (the attack and the spy, kept as last targets). The send
  check of the Landnahme gets the planet limit through `SendFleet.colonies()`.
* **[V]** Built with #54, within the decisions of #116: the folder
  `missile` (Raketenangriff, 90) with the optional typed field `launch`
  (`'fleet'` unless a mission says `'missiles'`, read through `launchOf`):
  the fleet form lists `FLEET_MISSIONS`, `send` refuses the others, and
  `isFleet` keeps them out of the fleet slots and the recall. Missiles
  whose target is gone are lost instead of turning back. The launch is its
  own action with its own pure check, `launchError` of
  `src/core/missiles.ts` ([Missiles](/features/missiles.md)).
