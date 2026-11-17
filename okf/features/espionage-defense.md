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
  [Activity indicators](/features/activity-indicators.md#what-sets-activity).

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
* **[V]** The thresholds are stored as `roundRecognitionTotal`,
  `roundRecognitionTypes` and `roundRecognitionCounts` (2, 4 and 8 without
  a setting, so existing universes need no migration). `roundRules()` reads
  them as `recognition`; the universe settings show them as „Fremde Flotten:
  Schiffe insgesamt ab Auspex-Lehre“, „Fremde Flotten: Schiffstypen ab
  Auspex-Lehre“ and „Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre“,
  in whole levels from 0 to 100 (0: every player sees that part). The
  dialog „Neue Runde“ has the same three fields, preselected with the
  current values; a new round without them keeps the current values. Both
  paths write the same settings, and the round reset's audit entry holds
  them. The check is `recognitionErrors` and `recognitionOf` of
  `src/core/fleet-recognition.ts` (#214); the server refuses with the
  message of the universe settings, „<Name>: ganze Zahl von 0 bis 100.“,
  every wrong value at once.
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
  8, no zero counts, each threshold on its own, a property test, the round
  choice), `src/core/universe.test.ts` (the three settings),
  `src/client/logic/overview.test.ts` (the row),
  `src/client/logic/round.test.ts` and `src/client/views/misc.test.ts` (the
  dialog).
* Server: `src/server/game/fleet-recognition.test.ts` (the levels, nothing
  hidden in the answer, the settled research, every mission, a group
  attack, own fleets, the guild event, the round, the refusal and the live
  change in the settings); `src/server/game/missions.test.ts` (every
  mission).
* E2E: `e2e/incoming-fleets.spec.ts`, desktop and phone: the defender at
  Auspex-Lehre 0 to 8 with the answer of `/api/state`, and the admin on the
  mail server with the dialog and the universe settings; axe on the
  overview, the dialog and the settings.
