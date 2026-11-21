---
type: log-entry
date: 2026-11-21T10:00
kind: Code
issues: [95, 253]
---

#95, #253. The action „Mondbruch“ at a foreign moon on the Sternenkarte is built (owner, 2026-11-21; it was left to #253, which did not deliver it). It is a link in the row of the moon and in the phone sheet, after „Versorgungsflug“, and opens the fleet form with the moon as the target and the mission chosen. It shows when the rules allow the mission for the target (`canOffer` in `src/core/mission-fit.ts`, built on `missionsFor` and the `canSend` of the mission) and the shown planet has a Weltenbrecher [V], as „Landnahme“ asks for a colony ship. No own text apart from the term „Mondbruch“ [V]. Unit tests for the rule, the logic and the view; the E2E case of `e2e/moonbreak.spec.ts` now starts from the Sternenkarte, on the desktop and on the phone.
