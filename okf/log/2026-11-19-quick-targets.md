---
type: log-entry
date: 2026-11-19T19:30
kind: Feature
issues: [292]
---

#292 built with the owner's „Geklärt“ comments of 2026-11-17: the Schnellwahl of the fleet form also lists the main planet of each friend („Freund: Spieler [g:s:p]“), of each guild member („Gilde: Spieler [g:s:p]“, none with guilds off, a friend who is a member only as a friend) and the last 5 different foreign targets of a Sturmangriff and an Auspex-Erkundung („Ziel: Spieler – Planet [g:s:p]“, newest first, a target that is gone or changed its owner drops out and the next older one fills up, a player in vacation mode is left out of the targets but not of the friends and guild members), in one flat list after the own places. The server keeps the targets in the new table `last_targets` (migration `20261119T1830-last-targets`, written when the fleet is sent, deleted with a new round) and sends three lists of place ids in the new state part `quick` (order 200, `src/server/game/quick-targets.ts`). [V]: the table keeps the newest 20 targets per player; the typed mission field `remembered` marks the two missions. See [Cargo buttons of the fleet form](/features/fleet-cargo.md#the-schnellwahl-with-friends-guild-members-and-last-targets-292).
