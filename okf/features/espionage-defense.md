---
type: feature
title: Espionage defense and fleet recognition
description: The classic chance that probes are detected and fight, the activity in the Auspex-Bericht, and how much an attacked player sees of incoming fleets by espionage technology (issues #175 and #228).
---

# Espionage defense and fleet recognition

Issues #175 (classic espionage defense) and #228 (recognition of incoming
fleets), part of the Classic features (#222). #175 D1 to D5 are the
owner's decisions of 2026-11-14 in the comments of the issue; the open
points were answered on 2026-11-16.

# Espionage defense (#175)

* **[E]** Decided on 2026-11-14 (owner, #175 D1 to D5): the chance follows
  the owiki approximation (D1), detection is a random chance from 0 up to
  that maximum (D2), a detection gives no report (D3), detected probes
  fight a real battle (D4), and the report shows the activity of the last
  hour (D5).
* **[E]** Espionage technology 0 (owner, 2026-11-16, Q1): spying is
  possible only from espionage technology 1. A target at level 0 gives a
  detection chance of 0 %, which is wanted (owner, 2026-11-16, Q1b).
* **[E]** Ships of the target (owner, 2026-11-16, Q2): the chance is
  multiplied by (1 + ships / 100), so 100 ships double it. owiki gives no
  number for this.
* **[E]** Activity in the report (owner, 2026-11-16, Q3): the classic event
  list of owiki „Aktivität“, one rule shared with
  [Activity indicators](/features/activity-indicators.md#what-sets-activity):
  v0.76d with the change of v0.77b (owner, 2026-11-17), built by #229 in
  `src/core/activity.ts` (`activityPlaces`, `planetActivity`).
* **[E]** Unit of the formula (owner, 2026-11-17): the result is a
  percent. The maximum is (probes / 4) · (target's espionage technology /
  spy's espionage technology) · (1 + ships / 100) %, capped at 100 %
  (owiki „Spionagebericht“, section „Spionageabwehr“,
  https://owiki.de/index.php?title=Spionagebericht&oldid=77679). The page
  „Spionage“ (oldid=77813) has no formula; it says only that detected probes
  usually die in the first round and the spy gets a combat report about the
  lost contact.
* **[E]** Detected spying (owner, 2026-11-17): probes that survive the
  battle still deliver the Auspex-Bericht, and both sides get combat
  reports. A target with no ships and no defense means no battle: the
  probes survive and report. The fleets that hold at the target (#55) count
  as its ships for this rule and fight with it (owner, 2026-11-19, [V] for
  the rule; [Holding and ACS](/features/holding-acs.md)).

## Built (#175)

* `src/core/espionage.ts`: `counterMax` (the maximum in percent),
  `counterChance` (drawn from 0 up to it, D2), `detected` (one draw below
  the chance), `shownChance` (whole percent, rounded: owiki says the report
  rounds) and `spyTechError` (code `noSpyTech` below level 1, Q1).
* **[V]** The ships of the formula are all ships stationed at the target
  (owiki: satellites and probes too), not its defense; a spy below level 1,
  which only a fleet sent before Q1 can be, gets the cap of 100 %.
* The arrival (`src/features/missions/spy/arrive.server.ts`) draws the
  chance, then the detection, both from the seeded `rng`, every spying.
  Undetected, or detected at a target without ships and defense, the
  probes report and fly back as before.
* Detected at a target with ships or defense, the probes fight with the
  battle of the Sturmangriff, shared in `src/server/game/fight.ts`
  (`fight`, `battleReport`, `recordBattle`): debris of the destroyed probes
  (#45) and of the held fleets' losses, the moon roll (#53), the rebuilt
  defense, the audit entry; no loot. The fleets that hold at the target
  defend it too (`defenders`, owner, 2026-11-19): each owner gets the
  battle report of the defender. The cargo that no longer fits into a
  hold's survivors goes to the planet (#467, [Holding](/features/holding-acs.md)),
  and the report of the defender shows it.
  Survivors deliver the report and fly back; without survivors the fleet is
  gone and the spy gets no Auspex-Bericht (D3).
* **[E]** Texts confirmed (owner, 2026-11-18, #175): „Keine Aktivität in
  der letzten Stunde.“, „Auspex-Erkundung erst ab Auspex-Lehre 1.“,
  „Kontakt abgebrochen – deine Spähschädel wurden bei [g:s:p] entdeckt und
  zerstört.“, the title „Kampfbericht <Planet> [g:s:p] – Spähschädel von
  <Spion>“, „Chance auf Auspex-Abwehr: x %.“ and „Die Spähschädel wurden
  abgeschossen!“.
* Combat report of the spy: „Kontakt abgebrochen – deine Spähschädel wurden
  bei [g:s:p] entdeckt und zerstört.“ **[E]** when no probe survives;
  otherwise „Kampfbericht [g:s:p] – <result>“ as for an
  attack.
* **[E]** Combat report of the defender: „Kampfbericht <planet> [g:s:p] –
  Spähschädel von <spy>“, pushed as „spied“ like the warning; the warning
  „Auspex-Aktivität“ stays, with the shown chance and „Die Spähschädel
  wurden abgeschossen!“ when no probe survived.
* **[V]** What the report shows is scored with the probes sent and the
  target as they found it on arrival, before the battle.
* The report shows „Chance auf Auspex-Abwehr: x %“ (the drawn chance,
  rounded) and the target's activity under „Aktivität“: the marker of
  `planetActivity` with the round's thresholds at the arrival (one rule with
  the Sternenkarte, `placeActivity` in `src/server/game/activity.ts`), worded
  as there. **[E]** Without activity: „Keine Aktivität in der letzten
  Stunde.“ (the text of the issue's proposal); a report from before #175
  shows no activity. The new reports have no field `lost` any more.
* Sending refuses below Auspex-Lehre 1 with „Auspex-Erkundung erst ab
  Auspex-Lehre 1.“ **[E]** (row `send` of
  [Checks of the server actions](/architecture/action-checks.md)); the
  browser does not repeat it.
* **[E]** The Lexicanum article „Auspex-Lehre“ (#285) shows this rule
  instead of the old danger formula and table (owner, 2026-11-18):
  formula, table and paragraph are computed from `counterMax`, `PROBE_DIVISOR`,
  `SHIP_DIVISOR` and `MAX_CHANCE` of `src/core/espionage.ts`
  (`src/features/spy/lexicon.de.ts`), so the article cannot drift from the
  game; `counterChance` of `src/core/spy.ts` is gone. **[V]** Its wording is a
  proposal for the owner to check (see
  [Lexicanum texts](/features/lexicanum-texts.md)).
* **[E]** The article of the mission „Auspex-Erkundung“ no longer says what
  happens to shot-down probes (owner, 2026-11-18): that sentence is removed
  and nothing replaces it.
* **[E]** Dropped (owner, 2026-11-21): the expected chance before sending,
  next to „Auspex-Erkundung“ (a **[V]** of the issue). It needs the
  Auspex-Lehre and the ships of the target from an older report and would
  show a maximum only; the Lexicanum states the formula.
* Not built: an E2E of a detected spying, which the random draws of the
  server do not allow without a test hook (the unit tests pin it with given
  draws).

# Recognition of incoming fleets (#228)

* **[E]** Thresholds (owner, 2026-11-16, D1): classic 2 / 4 / 8 as the
  default, changeable by the admin per round: the total number of ships
  from espionage technology 2, the ship types from 4, the exact number per
  type from 8 (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
* **[U]** The source of 2 / 4 / 8 (a formula thread on the official board)
  is not verified; owiki was not checked for it.
* **[E]** The thresholds apply to every foreign fleet, not only to attacks
  (owner, 2026-11-16, D2).
* **[E]** Per-round values (owner, 2026-11-17, X1): the thresholds are set
  in the dialog „Neue Runde“ and stay editable in the admin panel during
  the round.

## Built (#228)

* **[V]** The server redacts: `foreignView()` of
  `src/server/game/state.ts` sends of a foreign fleet only what
  `seenShips()` of `src/core/fleet-recognition.ts` gives for the
  observer's settled Auspex-Lehre (`settleR`, so a level finished by now
  counts): `total` (the number of ships) from the first threshold, `types`
  (the keys of the ship types with at least one ship, without numbers) from
  the second, `ships` (the exact number per type) from the third. A part
  below its threshold is absent from the answer, never 0 or an empty list;
  cargo, start planet and return stay out as before. Each threshold counts
  on its own, so an unusual order of the admin's values (types before the
  total) still works.
* **[V]** D2 replaces the rule of #116 that only the attack shows its
  ships: the field `visible` of the missions' `rules.ts` is gone, and every
  foreign fleet follows the thresholds.
* **[V]** The missions that came after #228 (bundle 2 of the Classic
  features, merged 2026-11-19) follow the same model, taken as recommended
  from D2 and the notes of the features, none needs a rule of its own: the
  Mondbruch (#95) flies at a foreign moon and is shown to its owner like
  an attack (the old `visible: true`); a Raketenangriff (#54) is shown like
  a foreign fleet, its missiles counting as its ships ([Missiles](/features/missiles.md));
  a Vermessung (#190) flies to a free position, where no defender
  exists, so nobody sees it (the old `visible: false`; the filter of
  `stateFor()` lists only flights to the shown planet of the observer).
  The fields `visible` of the three rules are gone.
* **[V]** The thresholds are three entries of the registry of the round
  settings (#283, see
  [Admin](/features/admin.md#the-registry-of-the-round-settings-283)),
  defined in `src/core/fleet-recognition.ts` as its `roundSettings` (#310):
  `roundRecognitionTotal` (order 120), `roundRecognitionTypes` (130) and
  `roundRecognitionCounts` (140); the orders 60 to 90 are the
  activity markers of #229 and 100 and 110 are left to #55. They are stored as `roundRecognitionTotal`,
  `roundRecognitionTypes` and `roundRecognitionCounts` (2, 4 and 8 without
  a setting, so existing universes need no migration) and are named
  `recognitionTotal`, `recognitionTypes` and `recognitionCounts` in
  `roundRules()`; `recognitionOf()` gives them to `seenShips()`. Their
  labels are „Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre“, „Fremde
  Flotten: Schiffstypen ab Auspex-Lehre“ and „Fremde Flotten: Anzahl je
  Schiffstyp ab Auspex-Lehre“, in whole levels from 0 to 100 (0: every
  player sees that part; the range is [E], owner, 2026-11-18, on PR #300). Each is `live` (X1): a number field of the dialog
  „Neue Runde“, preselected with the current value, and a row of the
  universe settings, changed during the round. Both paths write the same
  settings, and the round reset's audit entry holds them.
* **[E]** The dialog „Neue Runde“ shows the three thresholds in one framed
  group (a fieldset) with the legend „Fremde Flotten erkennen“, like
  „Aktivität“ of #229; the field labels stay as they are (owner,
  2026-11-18, on PR #300).
* **[V]** The three entries are one group `recognition` with this legend
  (`legend` of the group in `src/core/fleet-recognition.ts`, as the rewards
  group has it): the request „reset“ sends them as one object `recognition`, and the server refuses
  every wrong threshold at once with the message of the universe settings,
  „<Name>: ganze Zahl von 0 bis 100.“ A new round without the object keeps
  the current values; an object that leaves a threshold out is refused,
  the rule of every group (#214). The hand-wired check of the first build
  (`recognitionErrors`, the three universe specs, the client's
  `roundNumbers`) is gone.
* **[V]** The overview and the fleet list show a foreign fleet as before,
  „Eine fremde Flotte von <Name> [g:s:p] erreicht deinen Planeten [g:s:p] ·
  <Auftrag>“, followed by what is seen in brackets: „(Zusammensetzung
  unbekannt)“, „(Schiffe insgesamt: 7)“, „(Schiffe insgesamt: 7 ·
  Abfangjäger, Frachtläufer)“ or the exact „(5 Abfangjäger, 2
  Frachtläufer)“; never a cargo (#259). Built in `foreignShips()` of
  `src/client/logic/overview.ts`.
* **[V]** Own fleets stay fully visible; the scan of the Auspex-Phalanx
  keeps its own rules (#53); the attack event in the guild chat (#169)
  holds no ships, so it discloses nothing. Each fleet of a group attack is
  a foreign fleet of its own and follows the same rule.

## Tests (#228)

* Unit: `src/core/fleet-recognition.test.ts` (below, at and above 2, 4 and
  8, no zero counts, each threshold on its own, a property test, the three
  entries of the registry and their check), `src/core/round.test.ts` (the
  order), `src/core/universe.test.ts` (the three settings),
  `src/client/logic/overview.test.ts` (the row) and
  `src/client/views/misc.test.ts` (the dialog with its fieldset and legend).
* Server: `src/server/game/fleet-recognition.test.ts` (the levels, nothing
  hidden in the answer, the settled research, every mission, a group
  attack, own fleets, the guild event, the round, the refusal and the live
  change in the settings); `src/server/game/missions.test.ts` (every
  mission).
* E2E: `e2e/incoming-fleets.spec.ts`, desktop and phone: the defender at
  Auspex-Lehre 0 to 8 with the answer of `/api/state`, and the admin on the
  mail server with the dialog and the universe settings; the group „Fremde Flotten erkennen“ with its three fields in
  the dialog; axe on the overview, the dialog and the settings.

* **[E]** Held fleets (#55, owner, 2026-11-19): a fleet that is holding at
  the planet of the observer (state `hold`) shows to him in full, with its
  holding time, whatever his Auspex-Lehre and the thresholds. The thresholds
  count only for a fleet still on its way to hold (state `out`), which goes
  through `foreignView` like every other foreign fleet
  ([Holding and ACS](/features/holding-acs.md)).
