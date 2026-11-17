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
* `src/client/views/Fleet.svelte` (since #118, bundle 3; before it
  `src/client/views/fleet.ts`) renders the fields with their buttons
  (`data-act="cone"`, `data-k`), `src/client/main.ts` fills the field and
  updates the preview; the class `.cargo` in `style.css` puts each button
  under its field.
* The list „Auftrag“ of the same form offers only the missions that fit
  the target: [Missions that fit the target](/features/fitting-missions.md)
  (#253).
* E2E in `e2e/fleet-cargo.spec.ts` (desktop and phone, axe on the form);
  the fleet-form flow of `e2e/flows.spec.ts` uses the even fill.
