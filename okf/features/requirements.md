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
* **[E]** Research is checked and paid on the shown planet, and the
  buildings it needs (Forschungslabor) are built there (issue #49, owner,
  2026-11-12: research starts on any own planet with a lab). This replaces
  D4 and the owner decision to build them on the home planet; the state no
  longer carries `home`. The action `build` still takes an optional `at`
  (an own planet), which the client no longer sends.
* **[V]** A research need that lacks energy production
  (Gravitonforschung) is not ready: „zu wenig Energie“; its cost line shows
  the energy production with the energy icon.
* **[V]** The same for a building need that lacks energy production
  (Weltenschmiede, #51); a building need on a planet without a free field
  is not ready: „Keine freien Felder“ (see [Planet fields](/features/fields.md)).
* **[E]** No confirmation dialog: cancelling refunds the full cost.
* **[E]** The catalog has no circular requirements (test in
  `src/shared/requirements.test.ts`).
