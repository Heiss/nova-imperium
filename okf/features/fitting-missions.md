---
type: feature
title: Missions that fit the target
description: The list „Auftrag“ of the fleet form offers only the missions whose target kind fits what is at the entered coordinates, and the „Schnellwahl“ enters an own planet or moon as the target (issue #253).
---

# Missions that fit the target

Issue #253 (owner, 2026-11-16, with „Geklärt“ of the same day and of
2026-11-17). Before it
the list „Auftrag“ of the fleet form offered every mission, whatever the
target; the server refused what did not fit, and still does.

# Decisions

* **[E]** The list „Auftrag“ shows only the missions that fit the target
  at the entered coordinates: on another player's planet no „Landnahme“,
  on a free position no „Sturmangriff“ (owner, 2026-11-16).
* **[E]** Hidden, not disabled (owner, 2026-11-16).
* **[E]** Target not known yet: the target is looked up while the
  coordinates are entered, like the target display. Until the answer
  arrives the list shows „Ziel wird geprüft …“ and „Flotte losschicken“
  is blocked (owner, 2026-11-16).
* **[E]** The chosen mission no longer fits after the coordinates change:
  the list switches to the first mission that fits, in the order of the
  form (owner, 2026-11-16).
* **[E]** Built after bundle 3 of #118, straight into the Svelte fleet
  view (owner, 2026-11-16;
  [Design patterns](/architecture/patterns.md), section 9).
* **[V]** The filter (taken as recommended): the pure
  `missionsFor(owner, site)` of the new `src/core/mission-choice.ts`
  keeps the missions whose `target` of their `rules.ts` fits the site,
  with `suits` of `src/core/missions.ts`, the rule of the send check and
  of the arrival. A new mission plugs in through its own rules. The
  server keeps its checks.
* **[V]** A moon as target (taken as recommended): the moon's own target
  kind decides. The site of a flight to the moon holds the moon as its
  planet; a free position and a Trümmerfeld are never a moon (#53), which
  `shunsMoon` of `missions.ts` says for the filter and the send check
  alike.
* **[E]** „Bergung“ is offered in addition to the missions that fit the
  planet or the free position there, wherever a Trümmerfeld lies (owner,
  2026-11-17; built as [V] before). A Trümmerfeld lies beside the planet
  of its position (#119), and the form has no target kind of its own for
  it; `suits` decides.
* **[E]** The start planet as target: no mission is offered while the
  target is the place the fleet starts from (owner, 2026-11-17). The list
  is empty and „Flotte losschicken“ is blocked; the empty list shows no
  text. `TargetSite.start` says it to `missionsFor`.
* **[V]** A Trümmerfeld beside the start planet keeps its „Bergung“: it
  is a place of its own (#119), the server sends such a fleet, and the
  owner's first decision of the same day offers the Bergung in addition
  to what fits the planet there. Then the list holds only „Bergung“.
  Without it a player could not salvage the field above the own planet
  from that planet.
* **[V]** Only the target kind and the start are asked, not the mission's
  own `canSend` (its ships, the noob protection): the server refuses
  those with its messages, as before.
* **[E]** „Ziel wird geprüft …“ stays as built and shows only once a real
  lookup exists (owner, 2026-11-17; O20 of the
  [Open points](/open-points.md), settled). The client holds the whole
  galaxy and every Trümmerfeld in its state, so the target is known at
  once. The state with the blocked send is in the component and in
  `missionChoice()` (a target without a known site) and tested there.
* **[E]** Where no mission fits, the list is empty and „Flotte
  losschicken“ is blocked (owner, 2026-11-17, with the start planet).
* **[V]** A button of the Sternenkarte still preselects its mission; it
  always fits its target.
* **[E]** No new text besides „Ziel wird geprüft …“, „Schnellwahl“ and
  „– wählen –“ of the owner.

# Schnellwahl

* **[E]** The fleet form gets a list labelled „Schnellwahl“ with the
  player's other planets and moons, without the place the fleet starts
  from. Choosing one enters its coordinates as the target, and the list
  „Auftrag“ follows. An entry reads „Name [g:s:p]“, a moon with „(Mond)“
  as on the Sternenkarte (`placeName`); the first entry is „– wählen –“
  (owner, 2026-11-17).
* **[V]** Choosing a moon also sets „Zielart“ to „Mond“, a planet to
  „Planet“: else the moon's coordinates would aim at its planet.
* **[V]** Order: as the planet list of the header (`ownPlaces`), by
  coordinates, each moon after its planet.
* **[V]** After a choice the list goes back to „– wählen –“: the target
  is in the fields, which the player may still change, and the same entry
  can be chosen again.
* **[V]** Place: its own row „Schnellwahl“ below „Ziel“, with the same
  accessible name. Without another own planet or moon the row is left
  out.
* **[V]** Width: the list is at most 40 % of the screen wide
  (`#t_q` in `style.css`), so the longest name does not widen the form on
  a 360 px phone; the open list shows the whole name.

# Code

* `src/core/mission-choice.ts`: `TargetSite` and `missionsFor`, pure, with
  unit tests in `mission-choice.test.ts` (mutation floor 100).
* `src/client/logic/fleet.ts`: `targetSite()` (what the state holds at the
  target, and whether it is the start), `missionChoice()` (the options,
  the mission shown, or checking) and `quickTargets()` (the entries of the
  „Schnellwahl“ with the values they enter), with unit tests in
  `fleet.test.ts`.
* `src/client/views/Fleet.svelte` shows the choice it gets through its
  exported `aim()`; `aimFleet()` of `src/client/views/fleet.ts` aims it
  for `fleetCalc` of `src/client/main.ts`. The component enters a chosen
  entry of the „Schnellwahl“ into the fields `t_g`, `t_s`, `t_p` and
  `t_k`; `main.ts` then reads the form as after any change and gets no
  line for it. The component test `src/client/views/fleet.test.ts`
  renders the states of the list „Auftrag“ and the „Schnellwahl“.
* `src/test/fleet-reference.test.ts`: the frozen view got the one new row
  (`quickRow()`, written there on its own); everything else is compared
  as before.
* E2E in `e2e/fitting-missions.spec.ts` (desktop and a 360 px phone, axe
  on the form): the start planet without a mission and with the blocked
  send, the entries of the „Schnellwahl“, the own moon and the own colony
  chosen there, a free position with the switch of the chosen mission, a
  foreign planet with a Trümmerfeld, and the chosen mission over a
  refresh of the state.
