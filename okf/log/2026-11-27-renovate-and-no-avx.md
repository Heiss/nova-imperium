---
type: log-entry
date: 2026-11-27T20:10
kind: Decision and code
issues: [415, 385, 384, 365, 364, 341, 340, 32, 333, 15, 449]
---

Dependency updates of Renovate collected into one pull request for the release of the evening of 2026-11-27 (owner, 2026-11-27, 293a, again an exception for this release): #415 (zizmor 1.33.1), #385 (github/codeql-action 4.39.5), #384 (smtp-server 3.21.7), #365 (knip 6.48.0), #364 (astro 7.4.13 of the website), #341 (fast-check 4.11.0), #340 (Svelte 5.59.1) and #32 (pnpm 12.23.0). Left out (294a): #333 (prettier-plugin-svelte 4.2.0), which reformats 68 Svelte files and changes the whitespace the browser shows. Not included: #15 (TypeScript 7, a major version that waits). With them comes #449 (291a): the server has no CPU with AVX, so the job „Docker image and Compose stack“ starts the app a second time under QEMU user mode with the CPU model Denverton (no AVX, `compose.noavx.yaml`) and runs the smoke test against it. Shown locally before: a binary built with `-mavx` stops there with „Illegal instruction“, and the server starts, creates its database and answers. No changelog fragment: players cannot notice an update of the tool chain or a CI step (`changes/README.md`).
