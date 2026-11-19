---
okf_version: "0.2"
---

# Overview

* [Overview and goals](/overview.md) - purpose, scope, legend of the markers (E/V/U)
* [History of the decisions](/history.md) - how the project came to be, from version 1 to this setup
* [Open points](/open-points.md) - what the owner still decides or checks

# Architecture

* [System architecture](/architecture/system.md) - components, request flow, the game clock
* [Design patterns](/architecture/patterns.md) - catalog components, economy events, missions, repositories, Svelte components, feature folders, migration order
* [Checks of the server actions](/architecture/action-checks.md) - audit of #214, where each action checks, what the browser repeats, where they disagree, the follow-up pull requests
* [Docker operation](/architecture/docker.md) - services, volumes, secrets, hardening
* [SQLite storage](/data/sqlite.md) - schema, migrations, transactions, backup

# Features

* [Colony ships](/features/colonization.md) - founding and managing colonies
* [Interface v2 and planet types](/features/interface.md) - icon set, phone navigation, animated planets, planet type rule
* [Requirements list](/features/requirements.md) - all unmet requirements, startable ones with a button
* [Nanitenfabrik](/features/nanite-factory.md) - halves building and shipyard times, shared shipyard lock
* [Grimdark naming](/features/naming.md) - rename of all display names (#94), the names, what is applied, short and long texts
* [Ionengeschütz, Plasmawerfer and shield domes](/features/defense-ion-plasma-domes.md) - defense of #50, domes once per planet
* [Ionentechnik, Plasmatechnik, Gravitonforschung and IFN](/features/research-ion-plasma-graviton.md) - new research of #49, energy check of Gravitonforschung, research on any planet with a lab, research network
* [Explanation texts](/features/explanation-texts.md) - long texts with a display option per player (#63)
* [Level overview](/features/level-overview.md) - a ▤ next to the „?“ unfolds the next levels of a building or research with cost, time, effect and the difference to today, an option per player (#187)
* [Lexicanum](/features/lexicanum.md) - in-game lexicon of stage 1: an article per catalog entry and mission computed from the rules, side panel and page, search, shared level table (#285, #187)
* [Lexicanum texts](/features/lexicanum-texts.md) - review list of the texts Claude drafted for the Lexicanum: words before the formulas, mission texts, keywords, all [V] until the owner confirms them (#285)
* [Late-game combat ships](/features/late-game-ships.md) - Schlachtkreuzer, Zerstörer, Bomber, Todesstern of #56, classic values, drive switch
* [Solarsatellit](/features/solar-satellite.md) - energy satellite of #46, temperature formula, share, battle role
* [Fusionskraftwerk](/features/fusion-reactor.md) - deuterium-burning power plant of #47, throttling at an empty stock
* [Cargo buttons of the fleet form](/features/fleet-cargo.md) - „alles (gleichmäßig)“ fills the holds evenly, an „alles“ under each cargo field loads only its resource (#240)
* [Deploy mission „Verlegung“](/features/deploy.md) - moving ships and cargo to another own planet for good (#129)
* [Planet fields and the Weltenschmiede](/features/fields.md) - limited fields per planet and the building that adds them (#51)
* [Bergungsbarke, Trümmerfelder and „Bergung“](/features/debris.md) - debris of destroyed ships and the harvest mission (#45)
* [Moons](/features/moons.md) - moons from debris, Mondzitadelle, Auspex-Phalanx and Warp-Tor (#53), the mission Mondbruch (#95)
* [Endzeit](/features/endzeit.md) - the admin's gift fleet with everything unlocked for a mass battle at the end of a round (#161)
* [Error log and problem reports](/features/error-log.md) - server and browser errors, problem reports, admin tab „Fehler“ and download (#126)
* [Changelog in the game](/features/changelog.md) - „Neuigkeiten“, update message and hint from CHANGELOG.md
* [Push settings per kind](/features/push-settings.md) - which kinds of Web Push a player gets, per account for all devices (#192)
* [Guild ranks](/features/guild-ranks.md) - ranks with configurable rights, one Leitung, order, default rank, checked on the server (#163)
* [Guilds on or off per round](/features/guild-switch.md) - one switch „Gilden (mit Chat)“ in the dialog „Neue Runde“, off deletes the guilds and the server refuses every guild action (#191)
* [Guild chat](/features/guild-chat.md) - one chat per guild with three rights of the ranks, events of the server, a red mark on „Gilden“, 500 messages, deleted each round, read by the admin with an audit entry (#169)
* [Vacation mode](/features/vacation-mode.md) - pause the account, production stops, everything protected, minimum duration per round (#223)
* [Main planet](/features/main-planet.md) - the „Hauptplanet“ chosen in the options decides navigation and research, every switch locks it for a time set per round (#221)
* [Abandon a colony](/features/abandon-colony.md) - give up a colony without running references, everything lost with its moon, position locked per round (#224)
* [Own activity and play time](/features/own-activity.md) - private statistics per account and round in UTC days, sessions after 30 minutes (#231, #232)
* [Holding, alliance depot and attack unions](/features/holding-acs.md) - holding at other players, the depot later, attack unions with classic limits, who may join per round (#55, #225, #227)
* [Buddy list](/features/buddy-list.md) - mutual friendships, name and contact only, kept across rounds (#227)
* [Espionage defense and fleet recognition](/features/espionage-defense.md) - detection chance of probes, activity in the Auspex-Bericht, thresholds 2/4/8 for incoming fleets (#175, #228)
* [Activity indicators](/features/activity-indicators.md) - activity per planet and inactivity per account in the Sternenkarte, set by a login and manual actions (v0.77b), classic thresholds per round (#229)
* [Missiles](/features/missiles.md) - silo, anti-ballistic and interplanetary missiles with classic values (#54)
* [Expeditions and position 16](/features/expeditions.md) - Expeditionstechnik, outcomes, slots and holding time, debris at position 16 (#93)
* [Highscore categories](/features/highscore-categories.md) - buildings, research, fleet, defense and total; fleet and research by count (#78)
* [Demolition of buildings](/features/demolition.md) - one level per order, refund factor −100 % to +100 % and time share per round (#202)
* [Surveying free positions](/features/survey.md) - the mission „Vermessung“ with Spähschädel, the research „Auspex-Kartographie“, report tiers, loss and the values fixed for the colony (#190)
* [Marketplace](/features/marketplace.md) - exchange resources at ratios per pair with moving prices, the Handelsposten lowers the fee, cap by the free storage, limit per player per day (#171)

* [Invitations](/features/invitations.md) - registration only by invitation, mail or copied link
* [Admin](/features/admin.md) - operator roles, diagnostics, audit log, moderation and live universe settings
* [Round, administration and sign-in update](/features/release-checklist.md) - combined release checklist

# Security

* [Security measures](/security/review.md) - what protects accounts, data and the browser, and what is open

# Operations

* [Test strategy](/ops/testing.md) - unit, equivalence, E2E, accessibility, mutation, gates
* [Configuration](/ops/config.md) - environment variables, secret files, fail closed
* [Branching and release](/ops/branching-release.md) - pull requests with changelog fragments, CI Gate, release pull request, CalVer tags, hotfixes, Renovate
* [Release loop](/ops/loop.md) - `/loop` with `.claude/loop.md`: plan with the owner, clarify, build, make the release ready, keep it ready until the owner merges it, stop
* [Briefs for subagents](/ops/subagent-briefs.md) - what a task for a building subagent contains, the rules to state every time, and what went wrong before
* [Languages](/ops/language.md) - development in English, game interface in German
* [Defaults stay inside](/ops/defaults.md) - a fresh instance is closed and talks to nobody
* [Documentation website](/ops/website.md) - Starlight site on GitHub Pages from okf/ and docs/, with agents.md

# Log

* [Update log](/log/) - one file per entry in `log/`, newest first
