---
type: log-entry
date: 2026-11-28T11:30
kind: Code
issues: [478]
---

Attack union, delayed start of the leader (#478, owner, 2026-11-28): a leader whose fleet cannot reach the chosen arrival at once even at 10 % plans its start, at the arrival minus its flight at the step he chose. Until then the ships stay on the planet, held back from other orders, the plan takes a fleet slot and blocks the vacation [V]. The tick starts the fleet at its time with what is left and pays the fuel then; no ship left, too little Promethium, the planet lost or the target refused dissolve the union, the joined fleets turn back with a report. The leader can abort the planned start in the fleet movements, which dissolves the union as his recall does. Texts [V].
