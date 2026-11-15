---
type: log-entry
date: 2026-11-15T09:56
kind: Fix
issues: [53, 217, 216]
---

#53, two findings of CodeRabbit on pull request #217: the client's `act()` hands the data of an answer only to the newest action of its type, so a scan that a newer scan overtook no longer replaces its panel (its state still applies); the test of a planet out of range keeps [1:2:6] on the Sternenkarte and moves the scanning moon four systems away (its row is there, without the scan) and three systems away (the scan is offered); merged with `main` after #216 (see [Design patterns](/architecture/patterns.md)).
