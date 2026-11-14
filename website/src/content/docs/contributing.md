---
title: Contributing
description: How a change gets into Nova Imperium – issue forms, clarification with the owner, the pull request with tests, changelog fragment or label, the code style and the quality gates.
---

The owner decides what the game becomes; nothing is invented. A change
starts as an issue, is clarified with the owner, and is built in one pull
request. The rules behind this page are in
[Branching and release](/okf/ops/branching-release.md),
[Test strategy](/okf/ops/testing.md), [Languages](/okf/ops/language.md) and
[Release loop](/okf/ops/loop.md); where this page and those differ, they
are right.

## 1. Open an issue

Every issue starts from a form; blank issues are off
(`.github/ISSUE_TEMPLATE/`):

- **Bug report** (label `bug`): area, severity, steps to reproduce, expected
  and actual behaviour, version, browser and device, logs.
- **Feature or game content** (label `enhancement`): area, summary, problem
  and motivation, rules and behaviour, sources, dependencies, open
  decisions for the owner, and the German texts of the game interface.

Both forms ask you to search for duplicates first; the feature form also
asks you to check the scope and non-goals in
[Overview and goals](/okf/overview.md) and the
[Open points](/okf/open-points.md). Game rules follow the classic values;
the source is owiki.de first, ogame.fandom.com second.

## 2. Clarify it with the owner

Nothing is built while anything is unclear. Every open question goes to the
owner with 3 to 5 options and a recommendation (`AGENTS.md`). The answers are
recorded in the [OKF bundle](/okf/index.md) with their markers – **[E]**
decision of the owner, **[V]** proposal, **[U]** unverified – and the issue
gets one comment that starts with `Geklärt` and lists the decisions with a
link to the OKF concept. An issue with that comment is ready to build. What
goes into the next release carries the label `ready`, chosen by the
owner ([Release loop](/okf/ops/loop.md)).

## 3. Build it in a pull request

One issue, one pull request from `main`; `Closes #<issue>` in the
description. The [Git workflow](git-workflow.md) shows the way from the
draft to the squash merge. The pull request brings:

- **Tests first** for new logic; they check behaviour, not markup. Every
  acceptance criterion a player can see or do in the browser gets an E2E
  test; logic the browser cannot reach in reasonable time is set up with
  `e2e/seed.ts`. No test is skipped or disabled to get green
  ([Test strategy](/okf/ops/testing.md)).
- **Mutation floors**: no file below its floor in `mutation-standard.json`;
  a new file needs 80 %, a security file 90 %.
- **A changelog fragment or the label** – see below.
- **OKF and docs**: decisions go into the OKF bundle and a line into
  [the log](/okf/log.md); operator-facing changes into `docs/`.
- **Database changes** only as a new migration at the end of
  `src/server/db/schema.ts`; a released migration is never moved, removed or
  changed ([SQLite storage](/okf/data/sqlite.md)).

Run `pnpm check` before every push; it runs lint, knip, jscpd,
dependency-cruiser, Prettier, the type check, the unit tests with coverage
and the build. The commands of every other check are in
[Development](/docs/development.md#checks).

## Changelog fragments and the label `kein-changelog`

Players read the changelog in the game under „Neuigkeiten“, so every pull
request that players can notice adds one file `changes/<name>.md` in German
(`changes/README.md`):

```markdown
---
art: neu
---

Nanitenfabrik: halbiert die Bau- und Werftzeiten jeder Stufe und sperrt
die Werft, solange sie ausgebaut wird.
```

- `art` is `neu`, `geändert` or `behoben`; at most 300 characters, no
  headings, written for players: no code, no internals, nothing a player
  should find out by playing.
- A pull request that extends a feature of the coming release changes its
  fragment instead of adding a second one: one entry per feature.
- A wrong text in a published release stays; the next release corrects it
  with a fragment `art: behoben` that starts with „Korrektur zu
  <version>:“. `CHANGELOG.md` is never edited by hand.

The CI job „Changelog fragments“ (`scripts/changelog.ts check`) requires a
fragment when a pull request changes `src/client`, `src/core`,
`src/features` or `src/server/game`, unless the pull request carries the label
**`kein-changelog`** – for refactoring, tests, tooling, docs and everything
else players cannot notice. It also checks the form of every fragment. The
release pull request turns the fragments into a section of `CHANGELOG.md`
([Git workflow](git-workflow.md#the-release-pull-request)).

## Code style

- **Language**: code, comments, test names, commits, pull requests, docs and
  OKF in English; everything players see in German
  ([Languages](/okf/ops/language.md)).
- **Formatting**: Prettier with single quotes and the Svelte plugin
  (`.prettierrc.json`); `.editorconfig` sets UTF-8, LF and two spaces.
- **ESLint** blocks a cyclomatic or cognitive complexity above 10, nesting
  deeper than 4 and functions longer than 50 lines; tests are free of the
  length rule (`eslint.config.js`).
- **knip** finds unused files, exports and dependencies (`knip.json`),
  **jscpd** copied blocks of 50 tokens or more in production code
  (`.jscpd.json`), **dependency-cruiser** forbidden imports: `src/core`
  imports neither server nor client and sees the features only through the
  generated index, a feature imports no other feature and stays pure except
  its `*.server.ts` parts, which only the server and tests import, the
  client never the server and the reverse, production code no test helpers,
  server, core and feature code no dev dependencies, no circular imports
  (`.dependency-cruiser.cjs`).
- **Coverage** of at least 90 % of the lines and 85 % of the branches
  (`vitest.config.ts`); a mutation score of at least 80 %
  (`stryker.config.json`).
- **Architecture**: the rules of the game live once in `src/core`, one folder
  per catalog entry and mission in `src/features`; see
  [System architecture](/okf/architecture/system.md) and
  [Design patterns](/okf/architecture/patterns.md).

## Labels

| Label            | Meaning                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `bug`            | Set by the bug report form.                                              |
| `enhancement`    | Set by the feature form.                                                 |
| `kein-changelog` | The pull request changes nothing players can notice; no fragment needed. |

## This website

The site is built from `okf/` and `docs/` at build time; there is no copy
to keep in sync. Change a decision in `okf/`, an operator page in `docs/`,
and the guide pages (this one included) in `website/src/content/docs/`. To
see the result:

```bash
cd website
pnpm install
pnpm dev      # or: pnpm build, which also checks every internal link
```

How it is built and published: [Documentation website](/okf/ops/website.md)
and the job „Documentation website“ in [CI and checks](ci.md).

## Design drafts

Mockups of the interface are in `docs/design/`, one folder per issue:
[Interface v2](/docs/design/interface-v2/README.md),
[Requirements list](/docs/design/requirements/README.md) and
[Explanation texts](/docs/design/explanations/README.md).
