---
type: log-entry
date: 2026-11-25T22:30
kind: Fix
issues: [406]
---

An exchange on the marketplace carries the price the player saw (#406, owner, 2026-11-25). Until now it ran at the price of the moment of the action, so an exchange of another player on the same pair between the display and the click gave less without a word. The server now refuses any lower price, with no tolerance, and nothing changes: „Der Kurs hat sich geändert: jetzt <Kurs>. Bitte erneut bestätigen.“; the form then shows the rate of now and keeps the amount. A test checks first that a lower price never gives more; the drift back towards the base only helps the player and never refuses.
