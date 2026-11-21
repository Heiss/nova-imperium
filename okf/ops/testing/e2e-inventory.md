---
type: Policy
title: 'E2E inventory'
description: 'The E2E tests of #68 and what they cover.'
---

# E2E inventory (2026-11-13, #68)

* 78 E2E tests in four files (67 desktop, 11 phone; `game.spec.ts` and
  `flows.spec.ts` are split into one spec per feature since #324): `game.spec.ts` 50,
  `flows.spec.ts` 15, `error-log.spec.ts` 8, `a11y.spec.ts` 5. Locally the
  suite took 3.2 minutes before #68 and 4.6 minutes after it; in the CI it
  took 2.8 minutes on `main` before.

* Flows of #68 found covered already: „Abbrechen“ of a research with refund
  („research starts on a colony with its own lab and is paid there“) and the
  daily reward („filters achievements and keeps tomorrow’s reward after
  claiming“, which now also checks that the resource bar rises by the
  reward of day 1, owner 2026-11-13).

* **[E]** Push in the E2E suite: the test covers the notice of a server
  without Web Push and „Deaktivieren“; sending stays with the unit tests of
  `web-push.ts` (owner, 2026-11-13, #68). A real subscription would need
  `NOVA_WEB_PUSH=1` with an HTTPS address and a push service.
