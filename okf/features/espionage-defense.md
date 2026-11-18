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
