---
type: Open Questions
title: Open points
description: What the owner still decides, checks or sets up; the proposals of the assistant to review.
tags: [open, review]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

The IDs are referenced in the pull request. Settled points stay listed with
their result.

# A. To decide by the owner

| ID | Topic | State and options |
|---|---|---|
| O1 | systemd unit | Version 1 had `nova-imperium.service`. It was removed because the start changed (build step, `.env`, secrets) and only Docker is tested. Options: leave it out; add an untested unit with `EnvironmentFile`; add a tested unit with a CI job. |
| O2 | Minimum password length | Kept at 6 like version 1. Options: keep 6; 8; 12; a passphrase rule. |
| O3 | Ranges of the universe settings | Proposals in [Admin](/features/admin.md) (speed 1 to 100, galaxies up to 9, …). Confirm or change. |
| O16 | „Angriff auf“ in the attack event of the guild chat (#169) | The owner's text of 2026-11-15, „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“, is built as given; the grimdark naming of #94 replaced the classic „Angriff auf …“ by „Feindkontakt! …“, so the naming test allows it in `core/guild-chat.ts` only. 1. keep the owner's text (built); 2. „⚔ Sturmangriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“, the mission's name; 3. „⚔ Feindkontakt bei [1:27:11] (Vex → Lea), Ankunft 20:15“, the word of the battle report. Recommended: 1 or 2. |
| O17 | Name of a deleted attacker in an attack event (#169) | The owner decided „ehemaliges Mitglied“ for a deleted name; the attacker is no member. 1. „Unbekannt“, as the fleet arrival names a player it does not know (built [V]); 2. „ehemaliges Mitglied“ for every deleted name; 3. „gelöschter Spieler“. Recommended: 1. |

# B. Tasks of the owner

| ID | Topic | State |
|---|---|---|
| O5 | Branch protection | Make "CI Gate" a required check of `main`. |
| O6 | Renovate | Install the Renovate app for the repository. |
| O7 | GHCR | After the first tag the package is private; set it public or log in on the server. |
| O8 | First run on the server | Domain, reverse proxy, `.env`, SMTP password file, first invitation and `nova admin`. |
| O10 | Release App and labels | The release App needs „Pull requests: Read and write“ for the release pull request (until then the workflow fails when it opens it). Create the label `kein-changelog`; the label `voller-lauf` is created by `release-ready.yml` on first use (#147, by hand if the App may not). Allow force pushes to `release/*` for the App; protect `hotfix/**` like `main` (decided 2026-11-12: only pull requests with a green CI Gate) ([Branching and release](/ops/branching-release.md)). |
| O9 | Up-to-date branches | Settled 2026-11-10: "Require branches to be up to date before merging" is enabled for `main` (owner), so the migration check and all other checks run against the current `main` ([SQLite storage](/data/sqlite.md)). |

# C. Unverified

| ID | Claim | How to check |
|---|---|---|
| U1 | The CI workflows run green on GitHub. | The first run of this pull request. |
| U2 | The reverse proxy snippets for Caddy and nginx in `docs/operations.md` work. | First real setup. |
| U3 | The arm64 image starts on real arm64 hardware. | A Raspberry Pi or an arm64 server. |
| U4 | Invitation mails reach real inboxes (SPF, DKIM of the sender domain). | First invitation through the real SMTP server; Mailpit only checks sending. |
| U5 | A look with a screen reader and the keyboard. | Manual; axe covers a part only. |

# D. Settled

| Topic | Result |
|---|---|
| Interface never clicked through (hand-over note) | Covered by the E2E suite on every pull request. |
| Old JSON state | Not imported (round 1). |
| O4 Merging | The assistant merges its pull requests itself after a green CI Gate and with no open review findings (owner, 2026-11-10). |
| O11 Model of places | Coordinates plus kind (`planet \| moon \| debris`), debris in its own table, position 16 with #93 (decided 2026-11-16, [Expeditions](/features/expeditions.md)); built as migration step 8 (#119) before #45 and #53. How a moon is stored (a row of `planets`) is a proposal (owner, 2026-11-12). Table layout, `planets.kind`, `Planet.kind`, `parsePlaceId()` and the fleet kind from the id prefix decided (owner, 2026-11-13); built with #119 as migration 15 ([Design patterns](/architecture/patterns.md)). |
| O12 Test files of the mutation skip | What Vitest runs (`src/**/*.test.ts`) and the test helpers (`src/test/**`, `src/server/test-helpers.ts`) start the mutation jobs of a pull request; `e2e/` does not (owner, 2026-11-13, #146, [Test strategy](/ops/testing.md)). |
| O13 Guild ranks (#163) | The owner answered all five points (2026-11-14): the Leitung chooses its own new rank at the hand-over (preselected the highest below the Leitung); a manager neither gives nor takes a right it lacks; rank names once per guild, case-insensitive; at least 2 characters; a button „Gilde auflösen“ for the Leitung while members remain, confirmed with the tag ([Guild ranks](/features/guild-ranks.md)). |
| O14 Guilds off per round (#191) | Settled (owner, 2026-11-14, [Guilds on or off per round](/features/guild-switch.md)): (a) a fixed warning below the box in the dialog „Neue Runde“, always shown [E], text [V]; (c) the sentence about a led guild in „Account löschen“ is hidden while guilds are off [E]; (b) the push kinds „Gildenereignisse“ and „Nachrichten im Gilden-Chat“ are decided with #169 and stay shown until then [E, as recommended], hidden while guilds are off since #169 (owner, 2026-11-15, O15 b); (d) the box stays in its own paragraph below „Belohnungen für die neue Runde“ [V, as recommended, no owner answer]. |
| O15 Details of the guild chat (#169) | Settled (owner, 2026-11-15, comment „Geklärt, Nachtrag“ on #169, [Guild chat](/features/guild-chat.md)): (a) the attack event „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“ at the launch and the member events „Anna ist der Gilde beigetreten.“, „… hat die Gilde verlassen.“, „… wurde aus der Gilde entfernt.“, „Anna ist jetzt Offizier.“, a deleted name as „ehemaliges Mitglied“ [E]; (b) the two push kinds are hidden while guilds are off [E], which settles O14 b; (c) the push text „Neue Nachricht im Gilden-Chat“, never the message [E]; (f) the red mark on „Gilden“ for messages unread since the last visit, stored per member [E]; (h) every existing rank below the Leitung gets read and write, only the Leitung deletes [E]; (j) a sentence in the changelog and the line „Die Spielleitung kann diesen Chat lesen.“ in the chat box [E]; (d) the box on the guild page, (e) no „Melden“, (g) deleting by the order of the ranks plus the own messages, the Leitung all, (i) one message every 2 s, (k) the whole history in the state, all as recommended [V]. Two details of the build are O16 and O17. This O15 and the O15 of #212 below got the same number in parallel branches. |
| O19 Hotfix ohne Migration (#213) | Settled (owner, 2026-11-16, [SQLite storage](/data/sqlite.md#migration-ids-213)): a hotfix brings no migration; schema changes go only through `main` and a normal release. The CI job „Migrations append-only“ refuses every new migration on a hotfix branch, so production always runs the migrations in the order of their IDs. „Letztes Release“ is the newest CalVer tag of all refs, version-sorted. |
| O18 Browser and server disagree (#214) | Settled (owner, 2026-11-15): (c) only the real contradictions become one, F10, F12, F15 and the order of F8 and F9, after the economy pull request of #214; every other finding keeps the browser's short note and the server's message [E] ([Checks of the server actions](/architecture/action-checks.md)). F8, F9 and F10 unified in the economy pull request of #214, F15 in the admin pull request (#256) (2026-11-16); F12 is still open. |
| O20 „Ziel wird geprüft …“ in the fleet form (#253) | Settled (owner, 2026-11-17, [Missions that fit the target](/features/fitting-missions.md)): it stays as built and shows only once a real lookup exists; today the client knows every target at once. |
| O15 Update log, one file per entry (#212) | Settled (owner, 2026-11-15, [Documentation website](/ops/website.md#update-log-one-file-per-entry-212)): (a) new entries carry a UTC time in `date` (`2026-11-15T00:30`) and a day lists its entries newest first; the entries before keep the date only and follow those with a time, by file name [E]; the time is required from 2026-11-15 on [V]; (b) the front matter `type`, `date`, `kind` and `issues` as built [E]; (c) `issues` lists every `#N` the text names [E]. `log.md` is an optional reserved file of the OKF specification (`SPEC.md` §2, §9), every entry is a concept with a non-empty `type` [E]. |
