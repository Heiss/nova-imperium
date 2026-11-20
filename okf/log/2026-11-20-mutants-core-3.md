---
type: log-entry
date: 2026-11-20T13:00
kind: Code
issues: [304, 237, 118, 171]
---

Mutation floors of four files (#304): new unit tests pin the Kolonialverwaltung (#237: cost 4000/8000/4000, factor 2, Forschungslabor 3, Spionagetechnik 4, Impulsantrieb 3) in `src/features/colonial/colonial.test.ts`, the initial state of the login in `src/client/logic/login.test.ts` (#118), and the Handelsposten (#171) was already pinned by `market.test.ts`. In `src/core/yard.ts` the message name of a lock reads its text without the unreachable fallback to the key (every lock is a catalog entry), which removed two equivalent mutants. No behaviour changed.
