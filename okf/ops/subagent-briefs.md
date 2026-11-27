---
type: process
title: Briefs for subagents
description: How the main agent writes a task for a building subagent so that a smaller model can do it, and what went wrong before - collected from the release loop.
---

# Briefs for subagents

The main agent plans, asks the owner and merges; subagents build
([Release loop](/ops/loop.md)). A subagent starts with nothing but its
brief, so the brief decides how well it works.

* **[E]** Subagents run on Sonnet with high effort while the weekly limit of
  the larger model is used up; the main agent prepares each task so that
  this model can do it well (owner, 2026-11-18).
* **[E]** The main agent learns from the results, changes the next briefs
  and records the experience here (owner, 2026-11-18).

## What a brief contains

A brief is complete when a reader without this conversation could do the
task. These parts were needed every time:

1. **The state.** The branch, its head commit, the pull request if one
   exists, and what an earlier agent already did or left unchecked.
2. **The decisions.** Where the owner's „Geklärt“ comments are, and that
   they are binding; the decisions are also written into the body of the
   issue (owner, 2026-11-27, 203b). A text or value the owner has not decided is never
   invented: the subagent stops that part and reports 3 to 5 options.
3. **What changed on main.** Each merged pull request the branch has to
   take in, named with what it moved. An old branch fails on exactly these.
4. **The steps, in order,** as a numbered list, each with the file or the
   command it concerns.
5. **The checks,** each named with its command, and the ones the CI runs
   instead.
6. **The rules that are easy to break,** stated every time (see below).
7. **The report.** The fields the main agent needs: head commit, what was
   done, every [V], the checks with their results, open questions.

One brief holds one task on one branch. Two tasks in one brief worked only
when the second built on the first.

## Rules to state in every brief

* Commit early and push often: a restart or a usage limit ends an agent
  without warning, and unpushed work is hard to recover.
* A local branch name can be taken by another worktree. Check out under a
  new local name and push with `git push origin HEAD:<branch>`.
* Never force push, never amend a pushed commit, never use `--no-verify`,
  never push to main, open no pull request.
* Never lower a mutation floor, never weaken or skip a test. A branch does
  not touch `mutation-floors.txt` at all and records no floor of a new file:
  the floors are written by the main agent from the merged report of a
  complete CI run (`node scripts/mutation-floors.ts`, #304, #317). A local
  Stryker run of single named files only lists survivors.
* `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
  for Playwright, never `playwright install`, `--trace off`, a unique
  `E2E_RUN` value for the data folder and an own `E2E_PORT` above 1024
  (three ports from it downwards), so runs of two agents do not wait for
  each other.
* `src/client/main.ts` has no more lines than on main (`pnpm lint:size`
  compares with the merge base; there is no file to edit and no number to
  keep: a branch that moves code out of `main.ts` just commits the smaller
  file). `size-ratchet.json` no longer exists (#317 part 4): a branch that
  still edits it conflicts, and the conflict is resolved by deleting the
  file.
* A new per-round setting is defined in the feature's own file of
  `src/core` and exported as `roundSettings`; nothing else is edited (the
  list is generated). It has its own `order` number, and the brief names
  the numbers other open branches already took. The feature tests its own
  entries, selected by key or group; a test that needs a full set of round
  values uses `roundDefaults()` (`src/test/fixtures.ts`) and never lists
  another feature's settings (#310).
* A client feature adds its `data-act` handlers (and form handlers) in its
  own module `src/client/features/<name>.ts` and exports it as
  `clientFeature`; nothing else is edited (the list is generated, and
  `src/client/main.ts` names no feature). The module tests its own handlers
  with the fake context of `src/client/features/test-ctx.ts`; a handler name
  or a form id that exists twice stops the start, and the guard test
  `src/client/features/registry.test.ts` checks the rules for all (#322).
* A server action and a part of the state are added in the feature's own
  server module, exported as `serverFeature` (`actions`, `guildActions`,
  `adminActions`, `state`); nothing else is edited (the list
  `src/server/features.gen.ts` is generated, and `dispatch.ts` and
  `state.ts` name no feature). A part of the state has its own `order`
  number, the next free ten above the highest, and the brief names the
  numbers other open branches already took; an action name, a state key or a
  number that exists twice stops the start, and the guard test
  `src/server/game/registry.test.ts` checks the rules for all. No list of
  action names or keys is kept anywhere else (`registry-pin.test.ts` is
  deleted, #317).
* A new repository is a file in `src/server/db/repos/` that exports
  `repository = { key: 'market', make: (db): MarketStore => ... } as const
  satisfies RepositoryModule`; `ctx.market` is typed by what `make`
  returns, so write the interface as the return type. Nothing else is edited
  (`repos/index.ts` names no repository; the list `repositories.gen.ts` is
  generated; a key that exists twice stops the start). A table that a new
  round empties is declared in the file of its owner (a repository, or any
  other file of `src/server`) as `roundReset = [{ order: 120, clears:
  ['my_table'] }]`, with the next free ten above the highest (`grep -rn
  "order:" src/server | grep clears`); a table that must survive a new round
  is declared as `{ keeps: ['my_table'] }`. `newRound` in `game/admin.ts`
  names no table. `src/server/game/round-reset.test.ts` seeds a row into
  every table of the schema and fails when a table is neither emptied nor
  declared as kept (#317).
* A new view is `export const clientViews = [{ key: 'market', mount, anew:
  true, menu: { order: 40, label: 'Marktplatz' }, tab?, glyph? }] satisfies
  readonly ClientView[]` in a file of `src/client/views/` (contract:
  `contract.ts`; a view still drawn as HTML gives `html` instead of
  `mount`). `mount.ts`, `index.ts` and `main.ts` are not edited; the list
  `views.gen.ts` is generated, a view key, a menu number or a tab number that
  exists twice stops the start, and `src/client/views/registry.test.ts`
  checks the rules for all (#317).
* Stop after two failed attempts at the same problem and report.
* A new E2E test goes into the spec of its feature, `e2e/<feature>.spec.ts`
  (a new file for a new feature), never into a collecting file; new seed
  fields go into a part of their own in `e2e/seed/`. The test owns its data
  (#302, #324): players from `uniqueName()`, guild tags from `guildTag()`,
  `register()` of `e2e/helpers.ts` for every player (it puts the home planet
  into the area of the test), other systems from `ownArea().system(i)`, no
  galaxy, system, tag or account written by hand (`src/test/e2e-own-data.test.ts`
  fails on it, and the seed command refuses planets outside the area). A test
  that checks the layout with large numbers uses `onlyOwnPlayers(page)`. No
  E2E test depends on a chance of the game or on the order of the tests;
  before the push run the new spec shuffled as well: `playwright test
  --fully-parallel --shuffle=<seed>` (see [Testing](/ops/testing.md)).

## What went wrong, and what the brief says since

| Seen | Cause | Since then |
|---|---|---|
| A local Stryker run said 100 %, the CI 93 %. | The machine was loaded by other agents; a test that times out counts as a killed mutant. | The brief says not to trust a score from a run with timeouts. At most two agents run. |
| Full unit test runs failed with timeouts in files the branch did not touch. | Several Stryker and E2E runs at once on four cores. | At most two agents; a file that timed out is run again alone and named in the report. |
| The work and the report of an agent were lost. | A restart or a usage limit before the push. | „Commit early and push often“ in every brief; the main agent reads the branch, not only the report. |
| An agent built a feature the owner had ordered for later. | The brief named the issue but not its „when to build“ decision. | The main agent reads all „Geklärt“ comments before it starts an agent. |
| An agent invented German texts. | The brief asked for a feature that needs texts, without a source for them. | The brief says which texts are decided and that the others are reported as [V] with their exact wording. |
| The CI Gate was red right after a pull request was opened. | Setting a label cancels the first run. | The newer run counts; the main agent checks which jobs were cancelled. |
| An E2E test failed with a strict-mode error. | `getByLabel` matches a part of a longer label. | The brief asks for `{ exact: true }` where one label contains another. |
| Every pull request failed the mutation gate at a file it did not touch. | A floor of 100 % was recorded from a partial run; a mutant survived on main. | A small patch to main first; the brief tells agents not to fix it on their branch. |
| An E2E test failed only on the phone project. | A fleet of an earlier test still flew to the position the test used. | Test data take a position no other spec uses; the cause is searched before a job is run again. |
| A merge of main lost no code but left a red guard test. | Main had gained a catalog entry that needed an article. | The brief lists what each merged pull request added and which guards react to it. |
| An E2E test failed about once in 20 runs with an error toast nobody caused. | The client sent an action by itself, and the server refused it because the player had just lost the right. | Found by logging the requests of the page in the failing test; such actions are sent `quiet` (#301). |
| About ten files conflicted in every feature branch and at every merge of main (#228, #202, #223, #55, #175). | The registry of the round settings was one hand-written list, and tests listed the whole registry, counted its fieldsets or took „the last four“ by position, so every new setting changed the tests of the others. | Every feature tests its own entries and one test checks the rules for all (#310); a feature registers its settings in its own file. |
| Agents waited minutes for each other's E2E run. | All runs used the same three ports. | `E2E_PORT` moves them; every brief gives an own value. |
| A pull request of a feature ran the complete mutation run although #312 had made it partial. | It changed `mutation-standard.json`, and every change of the mutation setup forced the complete run. | A change of floors only adds the files of those floors to the partial run (#313); the main agent checks in the review what triggers the complete run. |
| The partial mutation job took 62 minutes for 33 files. | One job without a cache, and no limit on the number of files. | More than 12 changed files run the six shards (#321). |
| A merged floor was below the one on main. | The brief said „take the lower floor“ for a conflict in `mutation-standard.json`. | For a file both sides changed: the value of main or the higher one, never a value below main's. |
| Every branch that touched a floor conflicted in `mutation-standard.json`, and every branch that changed `src/client/main.ts` in `size-ratchet.json` (#317 part 4). | Both were files with one entry per branch, in one JSON object (a comma on the last line) and one number everybody had to set to the same value. | The floors are one line per file, sorted, in `mutation-floors.txt` (`merge=union`), and a branch does not write them; the size of `main.ts` is compared with the base by git and no file holds it. |
| A reference test that draws 300 random cases failed after a merge. | A rare mark was no longer among the drawn cases. | Rare cases are built by hand next to the sample; `numRuns` is not raised. |
| The phone E2E test of the highscore overflowed after another spec changed. | The specs share one database (#302): one spec seeded a research level that gave a 31-digit score. | Related specs run in one invocation; seeds stay small; the cause is searched with a diagnostic in the test, not guessed. |
| An E2E test became flaky after its seed was made realistic. | It depended on a 5 % chance of the game (probes lost). | No E2E test depends on a chance of the game: it repeats the step or seeds the outcome. |
| An agent invented game values that were not in the issue. | The brief named the feature but not the values. | The brief lists the decided values with their source; the others are asked from the owner before the build. |

## How the work is split (owner, 2026-11-18 and 2026-11-19)

* **[E]** At most two subagents run at a time.
* **[E]** A subagent runs only the cheap checks: type check, lint, format,
  dead code, duplicates, dependencies, the size ratchet, the checks of the
  OKF log and of the changelog, and the tests of the files it touched. It
  runs no full unit test run, no E2E and no Stryker; the CI does that
  while the subagent builds the next thing, and the main agent brings the
  findings of the CI to the subagent.
* **[E]** No floor is recorded from a local mutation run: under load a
  timeout counts as a killed mutant. A local run of single named files
  only lists survivors. The floors come from the merged report of a
  complete CI run only (owner, 2026-11-19, #304 option 1): the artifact
  `mutation-report` of the nightly run or of a complete run in a pull
  request, turned into floors by `node scripts/mutation-floors.ts
  <report.json>`, which never lowers a floor (`okf/ops/testing.md`).
  `node scripts/mutation-gate.ts --update` is gone.
* **[E]** Finished features are no longer bundled into one pull request
  (owner, 2026-11-27, 204b, the retrospective of 26.11.28): one issue is one
  pull request, at most four own pull requests are open, and the queue is
  drained before new work starts. Bundling stays allowed for small patches
  only.
* **[E]** A pull request runs the mutation tests of its changed files only;
  the complete run stays in the nightly run and in the release pull
  request (#309). Unit tests and E2E stay complete in every pull request.
* **[E]** When failures of one kind repeat (the same files conflict in
  every branch, one file grows with every feature), the main agent proposes
  a design pattern instead of fixing each case (#310, #317).
* **[V]** Order of merges: every merge puts the other pull requests behind
  main. The pull request whose rerun costs most (it changes the mutation
  setup, so it always runs completely) merges first when it is green.
* **[V]** After a merge the main agent resolves the small conflicts of the
  other branches itself (`mutation-floors.txt` after a merge: `node
  scripts/mutation-floors.ts --format` sorts it and names a file with two
  lines; the header of `e2e/seed.ts`, notes in `okf/`); a merge that touches game logic of two features goes
  to a subagent with a brief that names the interactions to check.
* **[V]** The folder `website/` has its own Prettier: `pnpm format:check`
  is run inside it when it is touched.
* **[V]** Tasks are tracked in issues, not in the memory of the session: a
  restart or a usage limit ends an agent without warning.

## Open

* Whether the briefs are detailed enough for Sonnet is measured only by a
  few tasks so far: on 2026-11-18 four tasks on Sonnet with high effort
  (an article with a merge check, two old branches brought up to date, one
  follow-up) came back complete, with pushed intermediate states and with
  an untrustworthy mutation run recognised and repeated. New work from
  scratch on Sonnet is not tried yet. [U]
