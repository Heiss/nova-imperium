---
type: feature
title: Requirements list
description: All unmet requirements of an entry, indirect ones included, with the startable ones highlighted and started by one button.
tags: [interface, requirements, buildings, research, shipyard, defense]
status: decided
generated: { by: claude-code/web, at: 2026-11-10T21:00:00Z }
---

# Decisions (owner, issue #64)

* **[E]** Gebäude, Forschung, Schiffswerft and Verteidigung list all unmet
  requirements of an entry under „Benötigt:“, one per line, indirect ones
  included, flat and without duplicates; the highest required level wins
  (D1). Code: `src/shared/requirements.ts`, `src/client/views/common.ts`.
* **[E]** An entry shows „Name – Stufe N (aktuell M)“; an indirect one adds
  „für …“ (the first requirement that needs it).
* **[E]** „Sofort startbar“: the next level has its own requirements met and
  the resources are enough (D2). It is drawn in `--ready` (#f0a050, the
  value of `--orange`, owner decision D5) with a border, the others in the error colour with the
  reason („braucht …“, „zu wenig …“). The line below a startable one shows
  the cost of the next level.
* **[E]** „Jetzt bauen“ / „Jetzt forschen“ start only the next level (D3);
  the view stays. While the queue is used the button is disabled and the
  reason is shown („Bauschleife belegt“, „Werft arbeitet gerade“, „Das Labor
  forscht gerade“, „Es wird bereits geforscht“, „Labor wird ausgebaut“).
* **[E]** Research is checked and paid on the home planet (D4). The buildings
  that research needs (Forschungslabor) belong to the home planet, also when
  a colony is shown; „Jetzt bauen“ builds them there (owner decision). For
  this the state of a colony carries the home planet (`home`), and the
  action `build` takes an optional `at` (an own planet) while the answer
  keeps showing the selected planet.
* **[E]** No confirmation dialog: cancelling refunds the full cost.
* **[E]** The catalog has no circular requirements (test in
  `src/shared/requirements.test.ts`).
