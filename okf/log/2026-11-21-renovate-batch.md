---
type: log-entry
date: 2026-11-21T22:00
kind: Decision and code
issues: [343, 341, 340, 339, 331, 329, 327, 308, 333, 15, 263]
---

Dependency updates of Renovate collected into the release 26.11.25 (owner, 2026-11-21, [E]: a decided exception to taking the updates one at a time, for this release only): #343 (actions/create-github-app-token 3.4.0 in four workflows), #341 (fast-check 4.10.3), #340 (Svelte 5.58.0), #339 (Vitest 5.1.1), #331 (Mailpit 1.34 in `compose.demo.yaml`), #329 (dependency-cruiser 18.8.0), #327 (typescript-eslint 8.73.0) and #308 (nodemailer 10.6.0), one commit each with exactly the versions and digests of their branches; every package version that differs from the lockfile of `main` is one of their lockfile diffs. Left out: #333 (prettier-plugin-svelte 4.2.0) reformats 57 Svelte files, and the reformat changes the compiled client (whitespace inside a template string and the update of an option's value), so it waits for a decision. Not included: #15 (TypeScript 7, a major version that waits for the owner, #263). No changelog fragment: players cannot notice an update of the tool chain (`changes/README.md`).
