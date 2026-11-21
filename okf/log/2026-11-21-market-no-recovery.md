---
type: log-entry
date: 2026-11-21T21:00
kind: Decision and code
issues: [346]
---

#346 (owner, 2026-11-21, [E]): the round setting „Marktplatz Preiserholung (Stunden)“ accepts 0, and 0 means no recovery: a price stays where the last exchange left it until the round ends ([Marketplace](/features/marketplace.md)). `DRIFT_HOURS` is 0 to 720 (default 24); `priceNow` returns the stored price with 0 hours; the label reads „Marktplatz Preiserholung (Stunden, 0 = keine Erholung)“ and the page „Marktplatz“ of the Lexicanum says „In dieser Runde erholt sich der Preis nicht.“ at 0. Changelog fragment `changes/marktplatz-preiserholung.md`.
