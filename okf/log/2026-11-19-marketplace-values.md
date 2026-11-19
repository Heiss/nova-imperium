---
type: log-entry
date: 2026-11-19T12:00
kind: Decision and code
issues: [171]
---

#171 finished with the owner's „Geklärt“ of 2026-11-19: the ratios follow 1 : 2 : 4 (500, 250, 2000, 500, 4000, 2000 per 1,000 given, no round trip gains), the fee is set per round (level 1 and the points each level takes off, 10 % and 1 by default, never below 0), the limit per day is set per round, 0 is no limit, and an exchange above what is left of the day is cut to it, not refused; the done message and the preview say so. [V] The new settings `roundMarketFee` and `roundMarketFeeStep` are the orders 420 and 430 of the group „Marktplatz“, whole percent from 0 to 100; when the storage and the limit both cut, the smaller amount wins and only its cause is named. The article of the Handelsposten reads the fee from the round and names the limit and the cut, with no typed number. See [Marketplace](/features/marketplace.md).
