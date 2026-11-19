---
type: feature
title: Cargo buttons of the fleet form
description: In the fleet form „alles (gleichmäßig)“ fills the holds evenly with the three resources, and an „alles“ under each cargo field loads only its resource (issue #240).
---

# Cargo buttons of the fleet form

Issue #240, label `ready` (owner, 2026-11-16). Before it, the one link
„alles“ after the three cargo fields filled Adamant first, then
Psikristall, then Promethium without the fuel, up to the capacity
(`cargoMax`, `src/client/logic/game.ts`).

# Decisions

* **[E]** A player may want to send all of one resource only; filling from
  left to right is awkward when there is more than fits (owner,
  2026-11-16).
* **[E]** The existing „alles“ fills evenly (owner, 2026-11-16).
* **[E]** Each resource gets its own „alles“ that loads only that resource
  (owner, 2026-11-16).
* **[V]** Even filling (D2, taken as recommended): equal shares of the
  capacity; a resource with less stock than its share gives the rest to
  the others, so the holds are full when the stock allows. Promethium
  counts after the fuel, as before.
* **[V]** Rounding: the resource with the least stock is filled first and
  each share is rounded up, so with more of everything than fits the
  extra unit of 10,000 / 3 goes to the resource with the least stock (on
  a tie Adamant, then Psikristall, then Promethium).
* **[V]** A per-resource „alles“ (D1, taken as recommended) keeps the other
  two fields and fills its resource up to the capacity they leave, at most
  its stock (Promethium without the fuel); the player can combine the
  buttons. When the other fields already fill the holds, it sets 0.
* **[V]** Placement (D3, taken as recommended; the owner suggested „am
  besten darunter“): one small „alles“ under each field, the even one
  stays after the fields.
* **[V]** Texts: under each field „alles“ with the accessible names „Alles
  Adamant“, „Alles Psikristall“, „Alles Promethium“; the even one reads
  „alles (gleichmäßig)“ (of the two texts the issue offered), so the two
  kinds are told apart.
* **[V]** The buttons under the fields are small buttons (`button.small`),
  so they are reached with the keyboard and carry their accessible names;
  the even one stays a link like the other links of the form.
* **[E]** No change on the server: the send keeps its checks.

# Code

* `src/client/logic/game.ts`: `cargoMax` (even, through `fillEvenly` and
  `loadable`) and `cargoOne`, pure functions with unit tests in
  `game.test.ts`.
* `src/client/views/fleet.ts` renders the fields with their buttons
  (`data-act="cone"`, `data-k`), `src/client/fleet-acts.ts` fills the field
  and updates the preview (out of `main.ts`, ratchet #242); the class `.cargo` in `style.css` puts each button
  under its field.
* E2E in `e2e/fleet-cargo.spec.ts` (desktop and phone, axe on the form);
  the fleet-form flow of `e2e/flows.spec.ts` uses the even fill.

# Missions that fit the target, and the Schnellwahl (#253)

Issue #253 with three „Geklärt“ comments (owner, 2026-11-16 and 2026-11-17).
The fleet form is still the string view `src/client/views/fleet.ts` on this
branch, so it is built there, not in a Svelte component.

* **[E]** The list „Auftrag“ shows only the missions that fit the target at
  the entered coordinates; the others are hidden, not disabled. When the
  chosen mission no longer fits after the coordinates change, the list
  switches to the first one that fits, in today's order.
* **[E]** The filter is a pure function in `src/core` (`missionsFor`,
  `src/core/mission-fit.ts`) on the target kind of each mission's rules; a
  moon target is decided by the kind of the moon. **[V]** It is built on the
  server's own check: `sendError` of `src/core/missions.ts` is now
  `fitError` (the target kind, which asks nothing of the ships) and then the
  mission's `canSend`, so the browser and the server cannot disagree. The
  ships a player picked do not change the list (a Landnahme stays listed
  before an ark is picked).
* **[E]** A Trümmerfeld adds „Bergung“ to the missions that fit the planet or
  the free position there. **[E]** While the target is the start planet
  itself no mission is offered.
* **[V]** What the browser cannot know stays offered, and the server refuses
  it as today: the noob protection of another player, his vacation mode
  (#223), and who is an ally for „Wache stellen“ (#55). The browser knows a
  lock after an abandonment (#224) from the state and keeps the free missions
  out of a locked position, as the server does.
* **[V]** While no mission fits (the start planet as the target, a moon that
  is not there, a locked position without a Trümmerfeld) the list shows one
  disabled entry „Kein Auftrag passt zum Ziel“ and „Flotte losschicken“ is
  blocked; the form starts at the start planet, so it is blocked until the
  coordinates change. **[E]** „Ziel wird geprüft …“ shows only once a real
  lookup exists: the browser has every planet of the universe in its state,
  so there is no lookup and the text is not built.
* **[E]** The form gets a select labelled „Schnellwahl“ with the player's
  other planets and moons; choosing one enters its coordinates (and
  planet or moon) as the target, and the mission list follows. Entries read
  „Name [g:s:p]“, a moon „Name (Mond) [g:s:p]“ as on the Sternenkarte; the
  first entry is „– wählen –“. **[V]** Entries by position, a planet before
  its moon; after choosing, the select goes back to „– wählen –“; it is
  disabled without another own place.
* Code: `src/core/mission-fit.ts`; `fitTarget`, `offeredMissions`,
  `missionOptions`, `ownQuickTargets`, `quickOptions` in
  `src/client/logic/fleet-target.ts`; the lists and their update in
  `src/client/views/fleet.ts` and `src/client/features/fleet.ts`
  (`missionList`, `quickChoice`).

# The Schnellwahl with friends, guild members and last targets (#292)

Issue #292, built after #253 with the owner's „Geklärt“ comments of
2026-11-17.

* **[E]** The list is one flat list without groups, in this order: the own
  places, the friends, the guild members, the last targets. The own places
  have no prefix (#253); a foreign entry gets a word: „Freund: Spieler
  [g:s:p]“, „Gilde: Spieler [g:s:p]“, „Ziel: Spieler – Planet [g:s:p]“
  (a moon as „Planet (Mond)“). Choosing an entry enters its coordinates as
  the target, and the mission list follows (#253).
* **[E]** Friends and guild members: only the main planet (#221) of each
  player, one entry per player; a player who is both is listed once, as
  „Freund:“. With guilds off in the round there are no guild entries (#191).
  A player in vacation mode (#223) stays listed as a friend or a guild
  member.
* **[E]** Last targets: the last 5 different foreign targets of the
  „Sturmangriff“ and the „Auspex-Erkundung“, newest first, per player across
  all their planets. A target that no longer exists or has a new owner drops
  out, and the list fills up with the next older targets until there are 5
  again; a player in vacation mode is left out of the last targets.
* **[E]** The server stores them per player in its own table when a fleet is
  sent (migration `20261119T1830-last-targets`, `src/server/db/repos/
  last-targets.ts`; the table also keeps the owner of the place at that time,
  to see a change of owner). The launch asks the typed field `remembered` of
  the mission's rules (the attack and the spy), so no code names a mission.
* **[V]** The state gets one part `quick` (`src/server/game/quick-targets.ts`,
  `serverFeature.state`, order 200) with three lists of place ids: the main
  planets of the friends and of the guild members, by name, and the last
  targets; the browser words the entries from the galaxy and the players.
  An own planet (a former target that changed to the player) is never a last
  target. The table keeps the newest 20 targets per player so that dropped
  targets can be replaced; a new round deletes it. The words „Freund:“,
  „Gilde:“ and „Ziel:“ are the owner's (above).
* Code: `quickTargets`, `ownQuickTargets` in
  `src/client/logic/fleet-target.ts`.
