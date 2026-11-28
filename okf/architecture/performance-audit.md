---
type: Architecture
title: Performance and maintainability audit of 2026-11-28
description: What was measured on the server, the client, the tests and the image, where the time and the bytes go, which issues hold the findings, and what is not measured.
tags: [architecture, performance, server, client, ci, docker, audit]
status: draft
generated: { by: claude-code/web, at: 2026-11-28T10:36:00Z }
---

# Why

The owner asked on 2026-11-28 how the backend could be made easier to
maintain and the architecture tighter, with the best UX possible: low
latency, connection drops of mobile internet handled without long loading
times, a shorter pull of the image and a shorter CI. A rewrite in another
language was looked at first ([Stack evaluation](/architecture/stack-evaluation.md)).
**Nothing in this concept is decided.** Every finding is in an issue with
the owner's open decisions; an issue gets `ready` only by the owner's word,
and the release loop builds it then ([Release loop](/ops/loop.md)).

Marks as in the issues: **[M]** measured, **[R]** read in the code, **[U]**
unverified.

# How it was measured

* **[M]** A sandbox with Node 22 (not the Node 26 of `.node-version`), 4
  vCPU Xeon 2.1 GHz, not the Celeron J4104 of [Overview](/overview.md).
  SQLite in memory, a synthetic universe of 20 players × 9 planets without
  fleets, reports or chat. The milliseconds compare only with each other.
* **[M]** The CI times are from the runs 46131882623 (#475, no mutation) and
  46127591953 (a pull request with a partial mutation run).
* **[U]** The final image could not be built in the sandbox (its apt step
  fails there); sizes of the layers are from the parts.

# Findings by component

| Component | Issue | Largest finding |
|---|---|---|
| Daily reward | #479 | The median of every player's production on every state, about half of `stateFor`, and a reward that depends on the time of the claim |
| Server, speed | #480 | No statement cache in production: `stateFor` 38.4 ms with 1,830 prepares, 11.7 ms with the cache of the tests [M] |
| Server, structure | #481 | 77 uses of raw SQL outside the repositories; feature knowledge in hand-kept lists of the HTTP layer and `core` [M/R] |
| Client | #482 | Every file downloaded in full on every load (`no-cache`, no ETag, fixed names); no timeout and no detection of a lost connection [R] |
| CI and tests | #483 | A partial mutation run is one job up to 12 files (44 min for 11 files); E2E with one worker and process starts per test [M] |
| Client, energy | #488 | The tick of every second also in a hidden tab, planet animations without a pause, no measurement; an E2E measurement with a gate decided [R] |
| Docker image | #484 | `node_modules` (43 MB, 27 MB of it better-sqlite3) a new layer in every release; deletions in later layers that save nothing [M/R] |

## Server

* **[M]** `stateFor` 38.4 ms and 1,830 statement compilations per call;
  with the statement cache of the tests (`src/test/statement-cache.ts`)
  11.7 ms; an action with its state 39.3 → 13.1 ms (#480).
* **[M]** The daily reward settles every planet of the universe on every
  state: 18.9 of 38 ms, 6.8 of 13.3 ms with the cache (#479).
* **[M]** N+1 queries: 4 per planet, 1 research query per player; the
  settings read 24 and 102 times per state (#480).
* **[R]** `GET /api/state` writes in a transaction (progress and day of the
  achievements) on every poll (#480).
* **[U]** 20 players polling every 4 s cost about 19 % of one core here.
* **[M]** Clean: no clones (jscpd), nothing for knip, no TODO markers,
  nesting at most 4 (#481).

## Client

* **[M]** `app.js` 501 KB raw, 173 KB gzip; `style.css` 58 / 14.7 KB; five
  fonts 114 KB. Only the Lexicanum and the level overview are lazy (#482).
* **[R]** The start runs `index.html` → `app.js` → policy → state → news
  one after another; an action is one request with the full state in the
  answer; `JSON.stringify` of the whole state compares every poll (#482).
* **[E]** Energy on the phone (owner, 2026-11-28, #488): an issue of its
  own, with a measurement in the E2E suite that catches a regression
  automatically. **[R]** The tick of every second runs in a hidden tab too
  (`clock.ts:42`), the planet animations have no pause outside the visible
  area; the largest lever, the poll every 4 s, goes with #409 [U].
* **[R]** What #409 decided (two states of the connection, no clicks while
  the server cannot be reached) needs a way to notice it: there is no
  timeout, no `AbortController` and no `online`/`offline` listener (#482).

## CI and tests

* **[M]** PR without mutation about 11 min, the E2E parts the critical path
  (7:10–9:30 each); with a partial mutation run 45 min (#483).
* **[M]** Unit suite 152 s for 7,205 tests, 85 s without isolation but with
  28 failures in files that mock modules (#483).
* Earlier work on the same question: #381 (proposal, open), #371 (static
  mutants, open), #370, #372 and #363 (done).

## Docker image

* **[M]** `node:26-slim` 355 MB, the Node binary 144 MB of it; production
  `node_modules` 43 MB, better-sqlite3 27 MB (8 platforms of prebuilds 17.3
  MB, SQLite sources 9.9 MB) (#484).
* **[R]** Alpine: musl builds of Node are „Experimental“; the security
  hotfix is built for Debian. Distroless: no apt (conflicts with Debian's
  security updates on top of the base, owner 2026-11-12, [Branching and
  release](/ops/branching-release.md)) and no shell (`docker/nova`). Both
  are options of #484, not recommended first.

# Decisions (owner, 2026-11-28)

All issues of the audit were decided the same day and are `ready`; each
body holds its decisions [E] and proposals [V], each has its „Geklärt“
comment.

* **#480** Statements prepared once in `make` of each repository; targeted
  queries for single things, one query per child table for the bulk
  methods, a light query of the coordinates for `galaxy`, no GraphQL; a
  read never writes; an indexed column `due` for fleets; the settings cached
  per database and dropped on `PRAGMA data_version`; the SQL of the state
  and action paths moved into repositories; target `main`.
* **#481** The registries first: password, vacation and audit as entries of
  each action, the consequences of a mission with the mission, a guard;
  then the SQL by area; `http/app.ts` split by route group; the pure battle
  steps to `core/`; the wrappers of `Store` to `src/test`
  ([Repositories and the Store](/architecture/patterns/08-store.md)).
* **#482** Hashed names with `immutable`, `index.html` with ETag, an offline
  app shell in a service worker; timeouts 8 s (poll) and 15 s (action); up
  to 3 repetitions of a lost action with the key of #450 after 2, 5 and
  10 s, 8 s each, stopped once the server is known unreachable (then O27 of
  [Data exchange and realtime](/architecture/realtime.md) holds); policy,
  state and news requested together; QR and WebAuthn lazy; a version of the
  state instead of `JSON.stringify`; all to `main`.
* **#483** Partial mutation parts by weight; Stryker concurrency 2; an
  in-process E2E helper per worker; 6 E2E parts after a shuffled run;
  Vitest isolated only where modules are mocked; a Playwright cache with
  the full download; #381 and #371 apart.
* **#484** Alpine with `apk upgrade` on top, arm64 dropped, a stage of the
  production dependencies, one prebuild of better-sqlite3, no tests and npm
  in the image, sizes recorded; one pull request ([Docker](/architecture/docker.md)).
* **#488** The tick stops while hidden; only changed texts are written; the
  animations pause outside the visible area, while hidden and below 20 %
  battery without charging (Battery Status API, Chromium); the E2E
  measurement in the night run, CPU 4× throttled, counts gated without and
  times with +50 % on the median of 3 runs, limits as a ratchet.

# Not measured

* Node 26, the J4104, a database on disk with WAL, lock contention,
  universes with fleets, reports and chat.
* The real transfer of a page load on a mobile connection.
* The final image size and the layers a release really changes.
