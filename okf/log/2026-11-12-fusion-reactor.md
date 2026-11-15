---
type: log-entry
date: 2026-11-12
kind: Feature
issues: [47]
---

Fusionskraftwerk (#47): key `fusion`, energy 30 · F · (1.05 + 0.01 · T)^F with the Energietechnik of the owner, deuterium use 10 · F · 1.1^F × speed, own share; at an empty stock it is throttled to the share where use equals production (bisection), `accrue` splits where the stock runs empty and `settle` where Energietechnik finishes; Gravitonforschung counts its energy (see [Fusionskraftwerk](/features/fusion-reactor.md)).
