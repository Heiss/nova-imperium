---
type: log-entry
date: 2026-11-21T08:00
kind: Code
issues: [54, 202]
---

#54 and #202, the demolition of the Raketenkrypta (owner, 2026-11-21, [E]): the check `demolitionErrors` has the code `siloBusy`. A level of the Raketenkrypta is not torn down while the places left after it would be fewer than the missiles there, the missiles in the shipyard queue counted as for the order of a missile (`siloUse`). Exactly as many places as missiles is allowed. The refusal says „Die Raketenkrypta lagert zu viele Raketen.“ [V], in the words of the refusals for a building in use; the button „Zurückbauen“ stays and the confirmation shows the text. Nothing is removed silently; the player tears missiles down first. The Lexicanum rule page of the demolition names the rule. Tearing the missiles down follows in the same branch.
