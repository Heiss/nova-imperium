---
type: Specification
title: Nova Imperium - overview and goals
description: Purpose, scope and legend of the decisions for the self-hosted browser game.
tags: [game, browser, node, sqlite, docker]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Purpose

A space strategy browser game for a small group of friends, in the style of
the browser games of 2007/2008: planets, mines, research, shipyard, defense,
fleets, espionage, battles, highscore. It runs on a server of the group (not on
a platform), the players need only a browser.

# Legend of the markers

The decisions are taken from the conversations with the owner (see
[History](/history.md)) and separate what is confirmed from proposals, as in
the muffelblog bundle whose rules this project follows:

* **[E]** Decision: explicitly confirmed by the owner.
* **[V]** Proposal: added by the assistant, not confirmed. The owner reviews it
  in the pull request.
* **[U]** Unverified: a claim that is not proven yet and must be checked.

# Fixed key points

* **[E]** The game is new code and new art; no scripts or graphics of the
  original game are used. Only the formulas of the classic rules (production,
  energy, building and research times, flight time, fuel, battle) are rebuilt.
* **[E]** Source of the classic rules: owiki.de first; its version notes
  separate classic values (before version 1.0) from later changes.
  ogame.fandom.com is the second source. A value counts as classic when the
  owiki page dates it before 1.0 (owner, 2026-11-12).
* **[E]** No premium, no paid boosts.
* **[E]** Scope: the core (planets, resources, buildings, research, shipyard,
  defense, galaxy, attacks, espionage, transports and [colonization](/features/colonization.md)).
* **[E]** Universe of version 1: speed x5, 2 galaxies × 50 systems × 15
  positions. Since this setup the admin changes these values in the admin
  panel (see [Admin](/features/admin.md)).
* **[E]** The server computes everything (resources, queues, fleet arrivals,
  battles), also while nobody is online; the browser cannot cheat.
* **[E]** TypeScript, development language English, game interface German
  (see [Languages](/ops/language.md)).
* **[E]** Data in SQLite (better-sqlite3), normalized tables (see
  [SQLite](/data/sqlite.md)).
* **[E]** Operation with Docker Compose, Caddy in front, behind the
  operator's reverse proxy (see [Docker](/architecture/docker.md)).
* **[E]** Registration only by invitation (see [Invitations](/features/invitations.md)).
* **[E]** Admins are made with an operator command, never through the web.
* **[E]** The development rules of the muffelblog bundle apply: test suite,
  mutation tests and CI gates (see [Test strategy](/ops/testing.md)).
* **[E]** License MIT, holder "Nova Imperium contributors".

# Non-goals (for now)

* Extensions of the classic game (recyclers, debris fields, moons,
  alliances, messages between players, missiles) are possible later steps,
  not decided. „More ships“ is no longer a non-goal (owner, 2026-11-12).
* No translation of the game interface.
