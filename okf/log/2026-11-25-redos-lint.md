---
type: log-entry
date: 2026-11-25T15:00
kind: Decision and code
issues: [367]
---

ReDoS lint (#367, owner, 2026-11-25, 80a/81a): the rule `redos/no-vulnerable` of `eslint-plugin-redos` 4.6.2 runs over every file `eslint .` covers, in its own configuration `eslint.redos.config.js` and the new CI job „ReDoS lint“, which runs for every change and which the CI Gate requires. Production code and `scripts/` may hold no expression of polynomial or exponential time, tests none of exponential time; a check that times out (30 s, the slowest of today's 850 checks took 3.2 to 3.6 s) is a finding too. The ten findings of the tree were rewritten, not disabled: the joining of lines in `scripts/changelog.ts` and `scripts/okf-log.ts`, the score line of `scripts/mutation-floors.ts`, the directive of `scripts/mutation-marks.ts`, the YAML key of `scripts/security-hotfix.ts`, the first sentence of the Lexicanum, its links (now read once from the left), the address check of invitations, the slashes of `NOVA_PUBLIC_URL` and the secret fields of the error log. Each has a test that it behaves as before on generated texts and that a hostile text of 50,000 characters, which took 0.8 to 5 s, now takes under 100 ms.
