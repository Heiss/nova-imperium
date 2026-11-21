---
type: log-entry
date: 2026-11-19T18:10
kind: Code
issues: [183, 114]
---

#183 built without a change of behaviour: the lab lock and the shipyard lock read a new component `locks` (`{ stops: 'shipyard' | 'research', home?: true }`, buildings only) instead of the keys `lab`, `yard` and `nanite`. [V] The three open points of the issue were decided by the recommendation, since no rule or value changes: the rules become a component; three entries share it (Schiffsschmiede, Machina-Schwarmhalle, Scholarium), so the rule of two entries of the patterns (§1) holds, with two kinds of lock; the release is the one of the collecting branch. `home` marks the building that is the place of what it stops, so `hasLab`, `hasYard` and the notice of the lock name no key either. The short name of the Schiffsschmiede in a message is the new optional text field `short` of its entry (the values of `YARD_LOCK` stay „Schiffsschmiede“ and „Machina-Schwarmhalle“). The allow-list of `src/test/catalog-keys.test.ts` lost both entries of the issue; `src/core/locks-reference.test.ts` compares every rule with its form before. See [Design patterns](/architecture/patterns.md). The comment of #114 is the source of the allow-list.
