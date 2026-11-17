---
type: feature
title: Missions that fit the target
description: The list „Auftrag“ of the fleet form offers only the missions whose target kind fits what is at the entered coordinates (issue #253).
---

# Missions that fit the target

Issue #253 (owner, 2026-11-16, with „Geklärt“ of the same day). Before it
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
* **[V]** A Trümmerfeld lies beside the planet of its position (#119),
  and the form has no target kind of its own for it. So „Bergung“ is
  offered wherever a Trümmerfeld lies, beside the missions that fit the
  planet or the free position there, as `suits` decides; nowhere else.
* **[V]** Only the target kind is asked, not the mission's own `canSend`
  (its ships, the noob protection) and not the start planet as target:
  the server refuses those with its messages, as before.
* **[V]** The client holds the whole galaxy and every Trümmerfeld in its
  state, so the target is known at once and there is no answer to wait
  for. „Ziel wird geprüft …“ with the blocked send is built in the
  component and in `missionChoice()` (a target without a known site) and
  tested there, but today's client never reaches it
  ([Open points](/open-points.md), O20).
* **[V]** Where no mission fits, the list is empty and the server refuses
  the send. Today that does not happen: „Mond“ can only be chosen where a
  moon is, and every planet takes a „Versorgungsflug“.
* **[V]** A button of the Sternenkarte still preselects its mission; it
  always fits its target.
* **[E]** No new text besides „Ziel wird geprüft …“ of the owner.

# Code

* `src/core/mission-choice.ts`: `TargetSite` and `missionsFor`, pure, with
  unit tests in `mission-choice.test.ts` (mutation floor 100).
* `src/client/logic/fleet.ts`: `targetSite()` (what the state holds at the
  target) and `missionChoice()` (the options, the mission shown, or
  checking), with unit tests in `fleet.test.ts`.
* `src/client/views/Fleet.svelte` shows the choice it gets through its
  exported `aim()`; `aimFleet()` of `src/client/views/fleet.ts` aims it
  for `fleetCalc` of `src/client/main.ts`. The component test
  `src/client/views/fleet.test.ts` renders the three states of the list.
* E2E in `e2e/fitting-missions.spec.ts` (desktop and phone, axe on the
  form): own planet, own colony, free position with the switch of the
  chosen mission, foreign planet with a Trümmerfeld, and the chosen
  mission over a refresh of the state.
