---
type: Policy
title: 'E2E tests'
description: 'Playwright E2E tests: the acceptance criteria of a pull request, seeding, mails, accessibility, one spec per feature and tests that own their data.'
---

# E2E tests

* **[E]** E2E tests with Playwright in the browser against the real server and
  a fresh database (`e2e/`), desktop and phone size. Every page records
  Content-Security-Policy violations and script errors; there must be none.

* **[E]** Every pull request brings E2E tests for each of its acceptance
  criteria that a player can see or do in the browser (owner, 2026-11-10).
  Logic that the browser cannot reach in reasonable time (for example a build
  that takes hours) is set up with `e2e/seed.ts` (planet, research, a
  colony, a finished queue). A test that passes at once is checked once by
  breaking the code it covers. Existing gaps are collected in an issue.

* **[E]** The gaps of #68 (game flows without a browser test, the table in
  the issue) are closed in one pull request (owner, 2026-11-13), fleet and
  battle first (attack with battle report and loot, transport arriving,
  recall, the max buttons, too little fuel, all fleet slots used, noob
  protection), then guilds, accounts, admin and the rest. Each area is
  checked against the specs again first; a flow that turns out covered is
  named in the pull request.

* **[E]** Flights, battles and queues of these tests are set up through
  `e2e/seed.ts` in the test database (land any fleet at once, finish a
  queue), as the colony test does; the server gets no test clock and no
  test-only code (owner, 2026-11-13, #68).

* **[E]** Mails in E2E tests (for example „Passwort vergessen“) go through
  real SMTP to a small mail sink that the E2E start runs on 127.0.0.1
  (`smtp-server` of the nodemailer project, a dev dependency); the test
  reads the link from the received mail. No production code changes for it
  (owner, 2026-11-13, #68).

* **[E]** The mail tests of #68 run against a second server of the E2E
  start (`e2e/env.ts`: port 8098, SMTP to the sink on 127.0.0.1:8025, login
  codes on), because SMTP and login codes on the first server would change
  the existing tests (the admin's „Kein SMTP eingerichtet“ and every login).
  The sink (`e2e/mail.ts`) writes each mail as a JSON line to a file the
  tests read. The new-round test runs there too: its own universe, so the
  reset touches no planet of the other tests. `e2e/seed.ts` lands any
  mission (`landFleet`), brings returning fleets home (`returnFleet`),
  finishes units of the shipyard queue (`finishUnits`) and dates the home
  planet back (`settledAgo`) (owner, 2026-11-13, #68).

* **[E]** Accessibility with axe (WCAG 2.1 A and AA) on the login and all 12
  views, with a self-test that proves the check finds problems
  (`e2e/a11y.spec.ts`). A look with a screen reader and the keyboard is still
  open.

* **[E]** One E2E spec per feature (owner, 2026-11-19, #317, #324): a
  feature brings its own file `e2e/<feature>.spec.ts` and appends to no
  collecting file (`game.spec.ts` and `flows.spec.ts` with 3,500 lines were
  split into 31 files of one feature each, the titles unchanged). Helpers
  that two specs share go to `e2e/helpers.ts` or a module of their own
  (`e2e/fleet-helpers.ts`), never copied. `e2e/seed.ts` is a frame: it reads
  the call, loads every file of `e2e/seed/` and runs the parts by their
  `order` in one transaction. A part handles and lists its own fields
  (`e2e/seed/colony.ts` has `colony`), a feature that needs a new field adds
  a file there, and a field no part lists is refused. The call
  `node e2e/seed.ts '<json>'` and the helper `seed()` did not change.

* **[E]** Tests own their data (owner, 2026-11-19, #302, #324). All specs
  run against one server and one database, so a test meets what an earlier
  one left. Three things are shared and each has a rule:
  * **Positions.** `register()` of `e2e/helpers.ts` puts the home planet of
    each new player into the area of the running test: a block of 4
    systems (`ownArea()`, `e2e/own-data.ts`) that no other test gets, from a
    counter in a ledger file (`e2e/ledger.ts`, next to the data folder).
    Home planets lie on slots 4 to 12 of the home system, colonies on the
    slots 1 to 3 and 13 to 15 (`colony: {}` is slot 15), further systems
    are `ownArea().system(1)` to `(3)`. Galaxy 1 holds no area: the
    registration form puts the planet there first, on a random position.
    A spec never writes a galaxy or system by hand.
  * **Names.** `uniqueName()` hands out player and planet names and
    `guildTag()` guild tags; both go to the ledger.
  * **The highscore** lists every player of the run. A test that checks the
    layout with large numbers calls `onlyOwnPlayers(page)`, so its page gets
    the state with its own players only.

* **[V]** The guard has two parts. At run time the seed command refuses a
  player the ledger does not know, an area nobody was handed, and any planet
  or moon of the player outside the area of the test; `seed()` also refuses
  a player of another test. The unit test `src/test/e2e-own-data.test.ts`
  reads every spec and refuses a literal galaxy or system in a place, a
  literal position „[g:s:p]“, a guild tag or an account written by hand, and
  `Date.now()` inside a text. A slot inside the own system (`p: 15`) is
  allowed: the system is the test's.

* **[V]** The universe of the E2E server is set when it starts
  (`e2e/env.ts`, `E2E_UNIVERSE`, written by `e2e/start-server.ts`): 9
  galaxies of 499 systems, because the default 2 × 50 has no room for one
  system per test (173 tests and growing); 8 × 124 = 992 areas. The
  database is not reset between the desktop and the phone project: every test
  has its area, so it does not need to be. A test that reads the size
  takes it from `E2E_UNIVERSE`, not from a number. Game defaults in `src/`
  are not touched.

* **[V]** The order of the tests must not matter (acceptance of #302). Run
  the suite shuffled with `--fully-parallel --shuffle=<seed>` (Playwright
  1.65; one worker stays): `E2E_PORT=4410 E2E_RUN=s1 playwright test
  --fully-parallel --shuffle=1`. The seed reproduces the order, and the
  phone and desktop tests are shuffled together. A test that fails only in
  some orders shares data with another: the audit log and the highscore are
  the shared places found so far (a test reads its own row). The CI could
  run one fixed seed next to the normal run; that costs another run of the
  suite.

* **[E]** A pull request into `main` runs the complete E2E suite, split over
  several jobs; the release pull request does not run it (owner,
  2026-11-23, 64a, #387, #372). **[V]** Four jobs „E2E tests (part N)“
  (taken as recommended: the number and the shares by measurement), each
  with its own servers and data on its own runner, each running the spec
  files of its part (`scripts/e2e-shards.ts files <N>`); the job „E2E tests
  (browser)“ needs all four, so the CI Gate and the proofs of a push (#342)
  see one job as before. The plan `e2e/shards.json` puts the longest file
  first into the part with the least time (`scripts/e2e-shards.ts plan
  <report.json>` from a JSON report of Playwright); a spec file it does not
  know runs in the part its name hashes to, so a new spec runs in exactly
  one job without a change of the workflow until the next plan places it
  by its time. Measured on 2026-11-24 (all 286 tests green, one worker): 83
  spec files, 37.7 minutes in all, 9.4 minutes per part with four parts
  (12.6 with three); each job adds its installation and build. Every part ran
  against its own servers and passed (66, 68, 76 and 76 tests), which shows
  that no spec depends on a spec of another part; part 3 ran with part 4
  beside it on one machine of four cores first, and there one test of
  `e2e/error-log.spec.ts` („a late answer to a report closes no dialog
  opened since“) waited 30 s for its answer of `/api/errors` and failed,
  then passed alone with the whole part [U: a load-dependent wait, to watch
  in CI].  A failed part keeps its report as
  the artifact `playwright-report-part-<N>`.
