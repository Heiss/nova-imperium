---
type: log-entry
date: 2026-11-25T23:30
kind: Fix
issues: [407, 240]
---

The „alles“ buttons of the fleet form send what the player wants, and the server computes the amounts from its stock at the launch (#407, owner, 2026-11-25). Until now the browser sent the numbers it had computed (#240): a stock that changed meanwhile was cut silently for Adamant and Psikristall or refused the launch for Promethium, and a stock that grew was not used. Browser and server now share one rule; the form keeps showing the amounts, computed again when the ships, the target or the stock change, and a field typed by hand stays its number.
