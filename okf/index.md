---
okf_version: "0.2"
---

# Overview

* [Overview and goals](/overview.md) - purpose, scope, legend of the markers (E/V/U)
* [History of the decisions](/history.md) - how the project came to be, from version 1 to this setup
* [Open points](/open-points.md) - what the owner still decides or checks

# Architecture

* [System architecture](/architecture/system.md) - components, request flow, the game clock
* [Docker operation](/architecture/docker.md) - services, volumes, secrets, hardening
* [SQLite storage](/data/sqlite.md) - schema, migrations, transactions, backup

# Features

* [Colony ships](/features/colonization.md) - founding and managing colonies
* [Interface v2 and planet types](/features/interface.md) - icon set, phone navigation, animated planets, planet type rule
* [Requirements list](/features/requirements.md) - all unmet requirements, startable ones with a button
* [Nanitenfabrik](/features/nanite-factory.md) - halves building and shipyard times, shared shipyard lock
* [Ionentechnik, Plasmatechnik, Gravitonforschung and IFN](/features/research-ion-plasma-graviton.md) - new research of #49, energy check of Gravitonforschung, research on any planet with a lab, research network
* [Late-game combat ships](/features/late-game-ships.md) - Schlachtkreuzer, Zerstörer, Bomber, Todesstern of #56, classic values, drive switch
* [Solarsatellit](/features/solar-satellite.md) - energy satellite of #46, temperature formula, share, battle role
* [Changelog in the game](/features/changelog.md) - „Neuigkeiten“, update message and hint from CHANGELOG.md

* [Invitations](/features/invitations.md) - registration only by invitation, mail or copied link
* [Admin](/features/admin.md) - operator roles, diagnostics, audit log, moderation and live universe settings
* [Round, administration and sign-in update](/features/release-checklist.md) - combined release checklist

# Security

* [Security measures](/security/review.md) - what protects accounts, data and the browser, and what is open

# Operations

* [Test strategy](/ops/testing.md) - unit, equivalence, E2E, accessibility, mutation, gates
* [Configuration](/ops/config.md) - environment variables, secret files, fail closed
* [Branching and release](/ops/branching-release.md) - pull requests with changelog fragments, CI Gate, release pull request, CalVer tags, hotfixes, Renovate
* [Release loop](/ops/loop.md) - `/loop` with `.claude/loop.md`: plan with the owner, clarify, build, make the release ready, stop
* [Languages](/ops/language.md) - development in English, game interface in German
* [Defaults stay inside](/ops/defaults.md) - a fresh instance is closed and talks to nobody

# Log

* [Update log](/log.md)
