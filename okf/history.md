---
type: Decision Record
title: History of the decisions
description: How Nova Imperium came to be, from a single-file version to the tested and containerized setup, derived from the conversations with the owner.
tags: [history, decisions, process]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

This page reconstructs the path of the project from the conversations with the
owner: an earlier chat in which the game was built (summarized by the owner in
a hand-over note) and the session that produced this setup. Only decisions and
their reasons are recorded; names, addresses, accounts and other private
details are left out on purpose.

# Phase 1: the idea

* **[E]** The owner wanted a browser game in the style of a well-known space
  strategy game as it was in 2007/2008, before premium currencies, to play
  with friends.
* **[E]** Everything is written new; no original scripts or graphics are used,
  only the game formulas of that time are rebuilt. This rule stays.
* **[E]** Scope of the first step: the core (planets, resources, buildings,
  research, shipyard, defense, galaxy, attacks, espionage, transports).
  Speed universe x5, 2 galaxies × 50 systems × 15 positions, one home planet
  per player.

# Phase 2: version 1 as a chat artifact (replaced)

* **[E]** The first version ran as a single HTML page inside the chat
  platform, with the game state in the platform's storage.
* **[E]** Replaced because most friends have no account on that platform.
  Lesson: the game must run on a server of the group and need only a browser.

# Phase 3: version 2, an own Node.js server

* **[E]** A Node.js server computes everything itself, also offline; the
  browser shows the state. Rules shared between server and browser in one
  file (`game.js`), so both compute the same.
* **[E]** At that time: no npm packages ("only Node.js ≥ 18"), the state as one
  JSON file saved every 5 seconds, login with scrypt-hashed passwords, sessions
  for 30 days, the first registered player became admin, an optional
  invitation code, systemd or Docker for operation.
* **[E]** Checked then: two players through the real interface (register,
  build, spy, attack with loot, return, restart with saved state) and the
  formulas by calculation. Not checked: the interface was never clicked
  through in a browser, the game never ran on the target server.
* The owner listed the next steps as open: click through the interface,
  install on the server (HTTPS with Caddy, invitation code), later extensions.

# Phase 4: publishing on GitHub (this session)

* **[E]** The owner uploaded version 2 as a ZIP and asked to publish it in
  the repository `heiss/nova-imperium`. It was pushed unchanged to the working
  branch; a data folder is never committed (`.gitignore`).
* **[E]** Then the owner asked to follow the development rules of the
  muffelblog project (OKF bundle): a full test suite, mutation tests and CI
  pipelines, so that only well-tested software reaches review; a quick-start
  documentation with settings in `.env` and important values in secret files;
  Docker with a Compose file; SQLite for the player data so it survives a
  reboot; the strict setup of that project; a professional pull request; this
  history. The owner asked to decide nothing alone, to bundle decisions and
  offer 3 to 5 options each.

## Round 1: language, storage, gates, cut of the work

| Question | Options offered | Decision |
|---|---|---|
| Language and tools | TS + English like muffelblog; TS + UI language as a variable; JS with JSDoc type check; JS and German | **TS + English like muffelblog** (UI stays German) |
| SQLite | `node:sqlite` normalized; better-sqlite3 normalized; `node:sqlite` with JSON documents; normalized plus import of `universe.json` | **better-sqlite3, normalized** (no import of old data) |
| Quality gates | exactly muffelblog at once; muffelblog with a ratchet for old code; stricter than muffelblog | **exactly muffelblog, at once**: all old code was rebuilt, no exception list |
| Cut of the work | several PRs `feature/wNN`; one PR with clean commits; two PRs | **one PR with clean commits** on the session branch |

## Round 2: secrets, admin, network, release

| Question | Options offered | Decision |
|---|---|---|
| Secrets | `NAME_FILE` + Compose secrets; only secret files; only `.env` | **`NAME_FILE` + Compose secrets**, both set = no start |
| Who becomes admin | `ADMIN_NAME` + password secret; one-time setup token; CLI command; as before | **CLI command**: nobody becomes admin through the web |
| Network and proxy | Caddy in front like muffelblog; only Node with headers; Caddy with automatic HTTPS | **Caddy in front like muffelblog**, strict CSP, inline scripts and styles moved out |
| Release (multiple) | CalVer + GHCR; Renovate; nightly mutation tests; backup scripts | **CalVer + GHCR, Renovate, nightly mutation tests** (no backup scripts; backup is documented) |

## Round 3: history, universe values, registration, license

| Question | Options offered | Decision |
|---|---|---|
| Source of the history | only this session; owner pastes chats; owner writes notes | the owner provided the **hand-over note of the earlier chat** (phases 1 to 3) |
| Universe values | `.env` with ranges; only the speed; stay in code | free answer: **the admin sets them in the admin panel** |
| Registration default | code required and generated; closed, admin invites; as before | free answer: **the admin enters an e-mail address and an invitation goes out; SMTP through environment variables** |
| License | MIT "Nova Imperium contributors"; MIT with the account name; other | **MIT, "Nova Imperium contributors"** |

## Round 4: conflicts and details

The hand-over note asked for German and no dependencies; round 1 chose
English and better-sqlite3. Asked, the owner confirmed **round 1 applies**.

| Question | Options offered | Decision |
|---|---|---|
| Hand-over note against round 1 | round 1 applies; TS but German docs; all German without packages | **round 1 applies**; each dependency is recorded with its reason |
| When universe values change | speed live, the rest at a new round; all at a new round; all live, size only grows | **all live, the size only grows** (never below a used coordinate) |
| Invitations | single-use link 7 days; plus copy the link; plus a switch for open registration | **single-use link for 7 days, bound to the address, plus copying the link** |
| Mail library | nodemailer; own SMTP client; nodemailer and no start without SMTP | **nodemailer**; without SMTP the admin copies the link |

# Consequences in this setup

* Version 1 is kept frozen in `src/test/legacy/` and the new rules are tested
  against it to the last digit (rules, catalog and art). The old JSON state is
  not imported (round 1).
* The old ways that the decisions replaced are gone: the invitation code, the
  first-registered admin, the JSON file, `node server.js`. The systemd unit was
  removed with them; whether it comes back is an open point.
* What the assistant added beyond the decisions is marked **[V]** in the
  concepts and listed in [Open points](/open-points.md) for the owner's review.
