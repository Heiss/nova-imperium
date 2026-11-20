---
type: log-entry
date: 2026-11-20T04:00
kind: Code
issues: [189]
---

Three E2E cases of the full run failed. Two were races with the redraw that the poll of the state causes (every 4 s, when the state changed): the address typed into the invitation form was `data-nokeep`, so a redraw emptied it before the click on „Einladen“ and the required field swallowed the click (`e2e/admin.spec.ts`, „the admin copies an invitation link“); `submitReport` of `src/client/features/report-problem.ts` reset the form it had read before the call, and a redraw during the call had put the text back into a new form (`e2e/error-log.spec.ts`, „a player reports a problem“). Fixed in `Admin.svelte` (the address is kept; a sent invitation clears it by the fresh render) and by resetting the form that stands on the page after the answer. Unit tests in `src/test/admin-reference.test.ts` and `src/client/features/report-problem.test.ts`. The third case, `e2e/research.spec.ts` „research starts on a colony“, asked for any text „Machina-Energetik (Stufe 1)“ and met the phone card „Läuft“ of #189 (hidden on the desktop by CSS, in the DOM); it asks for the cell of the overview table now. The card stays as decided.
