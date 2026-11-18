---
type: log-entry
date: 2026-11-18T23:50
kind: Decision and code
issues: [171, 283, 310, 242, 223, 202, 78]
---

#171 built with the owner's answers of 2026-11-17 (moving prices, a ratio per pair with a warning, the building Handelsposten, the result capped by the free storage, a limit per player per day, on by default, X1). [V] Ratios are amounts per 1,000 given with the example 1, 2, 3 as defaults; the price of the exchanged pair falls by a share of the amount and drifts back in a straight line (step 5, 24 hours); the fee is 10 % at level 1 and falls by one point per level; the limit counts the amount given per UTC day (100,000); a capped exchange takes only the amount that gives the free storage; all rounding is down in integers, proven by a property test. The ten settings are one group of live entries in `src/core/market.ts` (#283, #310, orders 320 to 410); the view is a plain view with its handlers in `src/client/feature-actions.ts`, so `main.ts` shrinks by two lines (#242). Migration `20261118T2324-marketplace` adds `market_prices` and `market_usage`. Seams for vacation mode (#223, not on its allow list), demolition (#202) and highscore categories (#78) are in [Marketplace](/features/marketplace.md).
