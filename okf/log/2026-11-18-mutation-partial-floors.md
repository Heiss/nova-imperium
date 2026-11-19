---
type: log-entry
date: 2026-11-18T23:00
kind: Fix
issues: [309, 312, 146, 300, 306, 281]
---

#309 follow-up to #312: the partial mutation run never took effect for a feature pull request, because almost every one adds or raises a floor in `mutation-standard.json`, and a change of that file counted as a change of the mutation configuration (#146): #300, #306 and #281 all ran the complete 6 shards. Now a change of `mutation-standard.json` adds to the partial set every file whose floor was added, changed or removed, when the file is mutated and exists, so a pull request proves its own floor (a removed floor is checked against the new-file minimum, a lowered one against its lower value; nothing refuses a lowered floor today and nothing was built against it). Only the floors are meant: any other value or key in the file, a file that cannot be read at the base or the head, or another file of the mutation configuration changed with it still runs everything. The hotfix paths and the takeover keep the file as configuration (coordinator, see [Test strategy](/ops/testing.md)).
