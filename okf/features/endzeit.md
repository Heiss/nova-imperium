---
type: feature
title: Endzeit – the gift of the Gottkaiser
description: An admin button for the end of a round: every player gets a gift fleet with every ship that flies, resources and, on arrival, everything unlocked (issue #161).
---

# Endzeit

Issue #161, in the next release (owner, 2026-11-13 and 2026-11-14). A
gimmick for the end of a round: everyone gets the late game at once and the
group fights one huge battle.

# Decisions

* **[E]** A button in the admin panel triggers it; the action is in the
  audit log (`admin.write`).
* **[E]** D1: 42 of every ship type that can fly (every ship with the
  component `mobile`); the Sonnenreliquiar cannot fly and is not part of
  the gift.
* **[E]** 1,000,000 of every resource (Adamant, Psikristall, Promethium),
  as cargo of the gift fleet; unloaded with `land()`, also above the
  storage (D4).
* **[E]** D2: every research and building is raised only to the level that
  its requirements and all unlocks need (for example Werft 12,
  Gravitonforschung 1); higher levels stay. Additions: Servitorenschmiede,
  Werft and Forschungslabor at least 20, Machina-Schwarmhalle at least 5,
  IFN at least 1.
* **[E]** D3: the buildings are raised on the home planet only. D4: they may
  exceed the field limit of #51.
* **[E]** D5: the start message is the owner's text with „Gottkaiser“:
  „Der allwissende Gottkaiser war gnädig und hat die Endzeit eingeläutet.
  Er möchte sehen, wie ihr ihn unterhaltet, wenn ihr seine Fähigkeiten
  bekommt.“
* **[E]** D6/D7: once per round, for every player with a home planet at the
  moment of the trigger, suspended and admin accounts included.
* **[E]** D8: the gift counts in the points like built ships: the ships from
  the trigger, as every fleet in flight; buildings and research from the
  arrival.
* **[E]** Nothing is taken away; the gift comes on top. The noob protection
  is unchanged.
* **[E]** Storage (2026-11-14): the mission stays `deploy` („Verlegung“);
  the new column `fleets.gift` (migration 17) blocks the recall in server
  and client, triggers the upgrades on arrival and selects the origin label.
* **[E]** Origin: `from` is the home planet itself; the deploy rule „other
  than the start planet“ does not apply to the gift. The fleet list shows
  the origin „Gottkaiser“.
* **[E]** Arrival: only the message „Die Gabe des Gottkaisers ist
  eingetroffen.“ with push, instead of „Verlegung erreicht“; the sentence is
  title and text (2026-11-14). The start message has the title „Endzeit“.
* **[E]** Flight time: an input in the confirmation dialog, 1 minute to
  72 h; it applies only to this trigger, fleets in flight keep their time;
  real time, not scaled by the universe speed.
* **[E]** Default flight time (2026-11-14, „Geklärt, Nachtrag“): its own
  field of the admin form „Universum“, in minutes from 1 to 4,320 (72 h),
  default 240 (4 h), saved with the other universe settings. The dialog is
  prefilled from it and may change the value for this trigger only; the
  trigger does not save it, so the last used value is never the default.
* **[E]** A running build or research of a key the gift raises, to a level
  not above the new level, is cancelled and refunded on arrival.
  A cancelled research is refunded on the planet where it started; when
  that planet is gone or no longer the player's, on the home planet
  (2026-11-14).
* **[E]** No fleet slot; fuel 0.
* **[E]** Performance: one battle of two full gift fleets is measured and
  reported in the pull request; there is no limit.
* **[V]** The mass battle is made of normal attacks between players; a
  battle of several parties comes with #55.

# Code

* `src/core/endzeit.ts`: the amounts (`GIFT_SHIPS_EACH`, `GIFT_RESOURCES`,
  `GIFT_MINIMUM`, the flight time range and default), `giftShips()` (42 of
  every key of `MOBILE`), `giftCargo()`, `giftLevels()` (the highest level
  each key appears with in the `req` of every building, research, ship and
  defense, with the minimums), `raise()` (higher levels stay) and
  `overtaken()` (a queued level not above the new level).
* `src/server/game/endzeit.ts`: the admin action `endzeit` (in `ACTIONS`,
  audited as `admin.write` through `ADMIN_ACTIONS` of `dispatch.ts`) and
  `giftArrive()`. Once per round: the setting `endzeitRound` holds the round
  of the last trigger (read with `ctx.admin.setting(key)`).
* Default flight time: the universe setting `endzeitMinutes` (an entry of
  `UNIVERSE_SPECS` in `src/core/universe.ts`, label „Flugzeit der
  Endzeit-Gabe (Minuten)“, `GIFT_MINUTES` as range, `GIFT_DEFAULT_MINUTES`
  as default). The form „Universum“, the check of the action `settings`
  (all values at once) and the storage come from that list, as for
  `extraFields` (#51). The admin state hands it to the dialog
  (`endzeitState`); the action `endzeit` checks its own `minutes` and
  stores only `endzeitRound`.
* Arrival: `onArrive` of `src/features/missions/deploy/arrive.server.ts`
  hands a gift to `giftArrive()`: ships and cargo land, the buildings of the
  home planet and the research are raised, an overtaken build or research
  is refunded (research on the planet where it started, else the home
  planet) and its push is cancelled; the other planets of the player are
  settled to the arrival first, as a change of the settings does, so the
  new research counts from the arrival.
* Fleets: `Fleet.gift` (`true` only on a gift); `fleets.count()` (fleet
  slots) leaves gifts out; only a gift writes the column. The recall
  refuses a gift: „Die Gabe des Gottkaisers kann nicht zurückgerufen
  werden.“ **[V]**
* Client: the fleet list shows „von Gottkaiser“ and no „Rückruf“ for a
  gift; the slot count of the fleet page leaves gifts out.

# Interface (German) **[V]**

* Admin panel, tab „Universum“: a box „Endzeit“ with the button „Endzeit
  einläuten“; after the trigger it says „In dieser Runde wurde die Endzeit
  schon eingeläutet.“
* Form „Universum“: the field „Flugzeit der Endzeit-Gabe (Minuten)“ (1 bis
  4.320), saved with „Einstellungen speichern“; a wrong value: „Flugzeit der
  Endzeit-Gabe (Minuten): ganze Zahl von 1 bis 4320.“
* Confirmation dialog: „Endzeit einläuten – alle Spieler erhalten die Gabe
  des Gottkaisers.“ with what the gift holds, the input „Flugzeit der Gabe
  (Minuten)“ (prefilled from the form „Universum“, 1 to 4.320, in real
  time, for this trigger only), „Ja, Endzeit einläuten“ and „Abbrechen“.
* Answer: „Die Endzeit ist eingeläutet. Gaben unterwegs: N.“; a second
  trigger: „Die Endzeit wurde in dieser Runde schon eingeläutet.“; a wrong
  time: „Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.“

# Tests

* `src/core/endzeit.test.ts`: 42 of every flying ship and no
  Sonnenreliquiar, the cargo, the derivation of the levels from the
  requirements with the minimums, higher levels kept, every requirement of
  the catalog met, `overtaken`.
* `src/server/game/endzeit.test.ts`: admin only; who gets it (suspended and
  admin accounts, not a player without a planet); the fleet (from and to the
  home planet, cargo, fuel 0, flight time not scaled, no slot); the start
  message with push; the flight time range; once per round and again after
  a new round, the default kept; the default from the universe settings; the audit detail; no recall; the points of the ships from
  the trigger and of the levels from the arrival; the arrival (ships, cargo
  above the storage, levels, home planet only, the message, no „Verlegung
  erreicht“); a cancelled and refunded build or research, a higher one
  kept.
* `src/server/game/endzeit-battle.test.ts`: one battle of two full gift
  fleets with the gift's research, measured (about 10 ms on the build
  machine, 6 rounds).
* `src/features/missions/deploy/deploy.test.ts`, `upgrades/migration-17.test.ts`,
  `src/server/db/repos/admin.test.ts`, `src/server/http/app.routes.test.ts`
  (audit as `admin.write`); `src/core/universe.test.ts` (the setting
  `endzeitMinutes`); E2E „the admin rings in the Endzeit …“ (the dialog
  prefilled with 240, the default kept after a trigger of 30) and, @phone,
  „the fleet list shows a gift from „Gottkaiser“ without „Rückruf“ …“ in
  `e2e/flows.spec.ts`, with the option `gift` of `e2e/seed.ts`.
