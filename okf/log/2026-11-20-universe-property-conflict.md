---
type: log-entry
date: 2026-11-20T17:05
kind: Code
issues: [237]
---

#237, test fix. The property „refuse exactly the values outside the range“ of `src/core/universe.test.ts` expected no refusal for every value inside its range. Since the rule between settings of #237 that is wrong for one case: „Kolonieforschung aktivieren“ = 1 with the default base limit 0 is refused as a `conflict`. A random run met it in the CI (mutation shard 9 of run 44777823815, seed -1738648806); verified locally with that seed. The property now expects the conflicts of the round for a value inside its range, the case is a fixed example of the property, and one plain assertion pins it. The code is unchanged.
