---
type: log-entry
date: 2026-11-28T01:55
kind: Code
issues: [426, 448]
---

Follow-up of #426 part 4 (#448), from the coordinator's review [V]. The start now stops, with the file named, at a line source of the overview cards with an unknown card (it was dropped without a word), without `lines` (it failed only when drawn) or without `keys`. Each source declares the kinds of its keys (`fleet`, `more-fleets`, `energy`, `reward`, `unread`, `idle`, `more-idle`), and a kind declared by two sources of one card stops the start with both files named, so two sources never draw one key in a card. Correction of the entry of part 4: its comparison before and after on 400 generated states was a test that was not kept. It is kept now: `src/client/logic/overview-cards-reference.test.ts` holds the two cards as they were before #448 and compares them with the registry on 400 generated view states, line for line, checks that every key drawn is of a kind its source declares, and that the generated states reach every kind. No change of what the cards show.
