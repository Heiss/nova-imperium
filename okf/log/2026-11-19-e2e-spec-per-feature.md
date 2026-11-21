---
type: log-entry
date: 2026-11-19T19:00
kind: Code
issues: [324, 317, 302]
---

#324 (part 3 of the clean-up #317, with #302): the E2E tests are one spec per feature and own their data. `e2e/game.spec.ts` and `e2e/flows.spec.ts` are split into 31 files of one feature each, with the same titles and the same tests (173, 125 desktop and 48 phone); shared helpers moved to `e2e/helpers.ts` and `e2e/fleet-helpers.ts`. `e2e/seed.ts` is a frame that runs the parts of `e2e/seed/` by their order, every part handling and listing its own fields. A test gets its players, its guild tags and its own area of the universe from the helpers: `register()` puts the home planet of each new player into the area of the test (4 systems from a counter), the E2E universe is 9 galaxies of 499 systems, the seed command refuses a player or an area no helper handed out and any planet outside the area, and `src/test/e2e-own-data.test.ts` refuses a galaxy, system, position, tag or account written by hand in a spec (#302). [V] No database reset between the projects: every test has its own area. The order of the tests is checked by shuffled runs (`playwright test --fully-parallel --shuffle=<seed>`); the shared audit log and highscore are read as the test's own rows. See [Test strategy](/ops/testing.md).
