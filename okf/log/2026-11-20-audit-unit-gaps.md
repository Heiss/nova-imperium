---
type: log-entry
date: 2026-11-20T12:00
kind: Code
issues: [55, 171, 288, 317]
---

An audit found behaviour without a unit test; tests only, no rule or text changed. `src/server/game/holding.test.ts` pins that no Promethium is refunded for unused holding hours after a recall (while holding and on the way out), after the host's vacation sends the guard home and for a guard that turns home at a host in vacation (#55, „kein Treibstoff zurück“ of 2026-11-19). `src/features/market/market.test.ts` pins the Handelsposten: cost 5000/10000/5000, factor 2, Servitorenschmiede 4, planets only (#171). `src/core/lexicon/pages.test.ts` guards that every lexicon part an entry or a mission registers, and every written page, is carried by an article (#288). `src/client/features/social.test.ts` tests the handlers of the guild chat and the buddy list with `fakeCtx` (#317).
