---
type: log-entry
date: 2026-11-20T23:30
kind: Code
issues: [118, 151]
---

#118, #151, follow-up of package 8. The position fields of the Sternenkarte (`g_g`, `g_s`) now have a field draft: what the player types stays over the poll redraw until Enter, an arrow or „zum Heimatsystem“ draws the page anew (a fresh render drops the drafts). Before package 8 they were `data-nokeep` and lost the typed value on a redraw as well; the E2E „galaxy: ◀ ▶ step through galaxies and systems“ only failed when a poll redraw fell between the typing and Enter. `e2e/redraw-drafts.spec.ts` has the deterministic case (verified red on the commit before package 8 and on the collecting branch). The other fields without a field draft behave as before: settings of the universe and chat and buddy name keep drafts of their own, the invitation link is read only, and the confirmation of a dissolving is in a modal outside the view.
