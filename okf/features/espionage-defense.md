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
  probes survive and report.

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
  (#45), the moon roll (#53), the rebuilt defense, the audit entry; no loot.
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
* Not built: the expected chance before sending, next to
  „Auspex-Erkundung“ (a **[V]** of the issue); an E2E of a detected spying,
  which the random draws of the server do not allow without a test hook
  (the unit tests pin it with given draws).

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
