---
type: log-entry
date: 2026-11-28T11:40
kind: Decision
issues: [480, 481, 482, 450, 483, 381, 371, 484, 488]
---

The owner decided every issue of the audit of 2026-11-28 the same day; all are `ready`, each with its decisions in the body and a „Geklärt“ comment, nothing built yet. #480: statements prepared once per repository in `make`, bulk queries only for the bulk methods, no write on a read, an indexed due time of fleets, settings cached until `PRAGMA data_version` changes, the SQL of the state and action paths into repositories. #481: feature knowledge into the registries first, `app.ts` split, the pure battle steps to `core`, the `Store` wrappers to `src/test` (a change of pattern 8). #482: cached files with hashes and an offline app shell, timeouts of 8 and 15 s, up to three repetitions of a lost action with the key of #450 until the server is known unreachable, a parallel start, lazy QR and WebAuthn, a version of the state, all on `main`. #483: partial mutation by weight, an in-process E2E helper, 6 E2E parts, Vitest isolated only where needed, a Playwright cache; #381 and #371 stay apart. #484: Alpine with `apk upgrade` instead of Debian (replacing the decision of 2026-11-12), arm64 dropped, smaller layers. #488: no tick in a hidden tab, no remounts by the tick, paused animations, a night E2E measurement with a ratchet ([Performance audit](/architecture/performance-audit.md)).
