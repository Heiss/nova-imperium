---
type: feature
title: Activity indicators
description: Public markers of activity per planet and of inactivity per account in the Sternenkarte, the events that set them and their classic thresholds, which the admin can change per round (issue #229).
---

# Activity indicators

Issue #229, part of the Classic features (#222): public markers in the
Sternenkarte, apart from the private play time of
[Own activity and play time](/features/own-activity.md). The owner's
answers of 2026-11-16 to D1 to D3 and Q1. Sources: owiki.de „Stern“
(„Aktivität“ redirects there,
https://owiki.de/index.php?title=Stern&oldid=78225) and „Inaktivität“
(https://owiki.de/index.php?title=Inaktivit%C3%A4t&oldid=78925).

# Decisions

* **[E]** Level (owner, 2026-11-16, D1): activity per planet, inactivity
  per account.
* **[E]** Long inactive accounts (owner, 2026-11-16, D3): only the marker
  „Inaktiv“, no deletion. Classic deleted an account after 35 days; that
  is not taken over.
* **[E]** Thresholds (owner, 2026-11-16, Q1): the classic values are the
  default, and the admin can change them per round (see
  [Admin](/features/admin.md#settings-per-round-from-the-classic-features-222)).
  Verified: a star for 15 minutes after an activity, then „x min“ counting
  up to 59 minutes, nothing after an hour (owiki „Stern“); inactive „i“
  after 7 days and „I“ after 28 days (owiki „Inaktivität“; classic showed
  „(iI)“, the Redesign „(I)“).

# What sets activity

* **[E]** The classic event list of owiki „Aktivität“, one rule for the
  Sternenkarte and the Auspex-Bericht of
  [Espionage defense](/features/espionage-defense.md) (owner, 2026-11-16,
  D2, #175 Q3).
* **[U]** Which version of the list: owiki's current list (login, the
  planet was spied, activity on a planet or moon, a click on the planet, a
  fleet sent from or arriving at the planet, a recall, a returning fleet,
  and a finished building with the paid Commander only) changed several
  times in 2007 (v0.76d, v0.77, v0.77b). A snapshot before 1.0 is not
  chosen yet; the Commander event falls away, as there is no premium.
