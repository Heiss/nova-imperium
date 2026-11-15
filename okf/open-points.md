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
| O15 a | Event messages of the guild chat (#169 D3, D4): not built, their texts and content are open | Attack (D3, at the launch): 1. „⚔ Angriff auf [1:27:11] (Lea), Ankunft 20:15“: target, member, arrival; 2. as 1 with the attacker, „⚔ Angriff auf [1:27:11] (Vex → Lea), Ankunft 20:15“, the issue's form with the member's name for „du“ (recommended: the defender sees the attacker anyway, and allies know whom to watch); 3. as 2 with the ships the defender sees; 4. only „Angriff auf Lea, Ankunft 20:15“. Members (D4): 1. „Anna ist der Gilde beigetreten.“, „Anna hat die Gilde verlassen.“, „Anna wurde aus der Gilde entfernt.“, „Anna ist jetzt Offizier.“ (recommended); 2. as 1 with who did it („… von Lea entfernt“, „Lea gibt Anna den Rang Offizier.“); 3. short with symbols („＋ Anna“, „− Anna“, „Anna → Offizier“). Also open: whether a name in an event becomes „ehemaliges Mitglied“ like a message (recommended: yes). |
| O15 b | Push kinds while guilds are off (O14 b, decided with #169) | 1. both stay shown, as now; 2. „Gildenereignisse“ and „Nachrichten im Gilden-Chat“ are hidden while guilds are off (recommended: nothing sends them then); 3. shown but disabled with a note; 4. hidden while off and for a player in no guild. |
| O15 c | Text of a chat push (#169 D5) | 1. the name of the kind, „Nachrichten im Gilden-Chat“ (built [V]); 2. „Neue Nachricht im Gilden-Chat“; 3. „Name: the first 80 characters“; 4. „[Kürzel] Neue Nachricht“. Recommended: 1 or 2, no text of the message in a push. |
| O15 d | Place of the chat | 1. a box „Chat“ on the page of the own guild below „Mitglieder“ (built [V]); 2. tabs on the own guild's page, for example „Gilde“ and „Chat“ (the issue's „tab“); 3. an own menu entry. Recommended: 1 until the guild view moves to Svelte (#118), then 2. |
| O15 e | „Melden“ (issue [V]) after D8 „Immer“ | 1. no „Melden“: the admin reads every chat anyway (recommended); 2. „Melden“ sends a problem report of #126 with the message; 3. „Melden“ marks the message for the admin in the „Ereignisprotokoll“. Not built. |
| O15 f | Red mark on „Gilden“ for new messages (issue [V]) | 1. new since the member last opened the chat, stored per member (needs a column); 2. new since the last visit in this browser, no storage on the server; 3. only for event messages; 4. no mark. Text of the mark, for example „Neue Nachrichten im Gilden-Chat“. Recommended: 1. Not built. |
| O15 g | Who deletes which message | 1. with the right: messages of lower ranks, of former members and the own ones, the Leitung all (built [V], the order of #163); 2. with the right: every message but the Leitung's; 3. as 1, and every member its own messages without the right; 4. with the right: every message. Recommended: 1. |
| O15 h | Chat rights of existing ranks (migration 20) | 1. only the default rank of each guild gets read and write (built [V], D2 as written); 2. every existing rank below the Leitung gets read and write; 3. every rank gets read, the default rank read and write. Recommended: 1; #163 is one day old, so few guilds have more ranks. |
| O15 i | Rate limit (issue [V] „for example 1 message per 2 s“) | 1. one message every 2 s (built [V]); 2. one every second; 3. five in 10 s; 4. none. Recommended: 1. |
| O15 j | Telling players that the admin reads the chats (D8) | 1. one sentence in the changelog fragment (built [V]); 2. as 1 and a fixed line in the chat box, for example „Der Admin kann den Chat lesen.“; 3. nothing. Recommended: 2. |
| O15 k | Size of the state | The chat (at most 500 messages) is part of every state refresh, every 4 s. 1. as built (recommended for a small group); 2. the last 100 in the state and „Ältere laden“; 3. the chat only while the guild view is open. |

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
| O11 Model of places | Coordinates plus kind (`planet \| moon \| debris`), debris in its own table, position 16 with #93; built as migration step 8 (#119) before #45 and #53. How a moon is stored (a row of `planets`) is a proposal (owner, 2026-11-12). Table layout, `planets.kind`, `Planet.kind`, `parsePlaceId()` and the fleet kind from the id prefix decided (owner, 2026-11-13); built with #119 as migration 15 ([Design patterns](/architecture/patterns.md)). |
| O12 Test files of the mutation skip | What Vitest runs (`src/**/*.test.ts`) and the test helpers (`src/test/**`, `src/server/test-helpers.ts`) start the mutation jobs of a pull request; `e2e/` does not (owner, 2026-11-13, #146, [Test strategy](/ops/testing.md)). |
| O13 Guild ranks (#163) | The owner answered all five points (2026-11-14): the Leitung chooses its own new rank at the hand-over (preselected the highest below the Leitung); a manager neither gives nor takes a right it lacks; rank names once per guild, case-insensitive; at least 2 characters; a button „Gilde auflösen“ for the Leitung while members remain, confirmed with the tag ([Guild ranks](/features/guild-ranks.md)). |
| O14 Guilds off per round (#191) | Settled (owner, 2026-11-14, [Guilds on or off per round](/features/guild-switch.md)): (a) a fixed warning below the box in the dialog „Neue Runde“, always shown [E], text [V]; (c) the sentence about a led guild in „Account löschen“ is hidden while guilds are off [E]; (b) the push kinds „Gildenereignisse“ and „Nachrichten im Gilden-Chat“ are decided with #169 and stay shown until then [E, as recommended]; (d) the box stays in its own paragraph below „Belohnungen für die neue Runde“ [V, as recommended, no owner answer]. |
