---
type: process
title: UX playtest of the interface „Modern“
description: Blind three-way picks along the game loop with the owner as test person, to find the interface and the loop for „Modern“ (#388, #236); plan, open work and the result of every round.
---

# UX playtest of the interface „Modern“

Owner's request (2026-11-23) **[E]**: a small website that shows three
pictures of the same situation with different emphases; the owner picks the
one they like better and write what they like about it; a short questionnaire
per round. We move along the game loop and repeat situations with other
emphases until it is clear what works. When Claude is sure what the owner
wants, it rewrites #388 and the design study. Claude acts as UX/UI designer,
the owner as test person.

* **[E]** The emphases are the three families of the research: browser
  strategy (A), 4X / space (B), mobile strategy (C) (#388).
* **[E]** The owner liked the mobile-first study (C) best so far
  (2026-11-23).
* **[E]** Missing until now and part of the loop: building on fields (#158)
  and ground combat / siege (#155); also the Imperialer Herold (#382) and
  the Börse (#386). Only the interface is shown; their rules stay open.
* **[E]** The loop starts after the login on the galaxy map with a few
  infos of the dashboard; the dashboard exists too.
* **[E]** Compact mode: only pictures, a click opens the info page with
  the build command, coloured by whether the resources are there.
* **[E]** The page is a private Artifact on claude.ai with its own store:
  https://claude.ai/artifact/XV9KCV5anS2kBRpZRyRsNg. Picks are in
  `picks/<round>-<situation>` (`choice` 1–3, `emphasis` a/b/c, `note`),
  answers in `answers/<round>`. Claude reads them with the Artifact data
  tool.
* **[E]** One situation at a time (owner, 2026-11-23, replaces 3–4 per
  round): the page shows only the first open situation; after the pick and
  the note, „Weiter“ opens the next; the questions close a round. Each
  situation shows three variants without labels, in a mixed order; the
  emphasis is shown after the pick. Picks are reopened with „Ändern“
  (`done: false`).
* **[E]** The dashboard („Lage“) is a sheet at the bottom that can be pulled
  up and down everywhere, so the right information can always be pulled up
  (owner, 2026-11-23, on the first version of round 1).
* **[E]** Systems hold up to 15 worlds and most players settle their own
  system, so the galaxy map cannot show single player worlds well; it shows
  systems and the routes between players (owner, 2026-11-23). Round 1 tests
  three ways (s1m) and the zoom into the own system (s1s).
* **[E]** Claude checks the store for new picks while the owner tests,
  prepares the next situations ahead, asks follow-up questions on the page
  („Rückfrage von Claude“, saved as `answer`), and keeps offering choices
  until it is clear how each view works (owner, 2026-11-23).
* **[E]** A situation counts only once the owner clicked „Weiter“
  (`done: true`); before that Claude reads nothing into the pick or the
  note and does not republish the page while a situation is open, because
  a republish reloads it (owner, 2026-11-23).
* **[E]** Races (#154) belong to v3: the interface changes with the
  chosen race; the Brut gets organic wobbling (owner, 2026-11-23).
  Decided the same day: the three races Imperium, Brut and Ewige (Schatten
  and Treck later, if they come, #154 R9); the Imperium keeps today's
  styling, Brut and Ewige get their own colours, shapes, type, frames and
  motion while the layout (map, Lage sheet, buttons) stays the same; they
  enter the playtest after round 1, with the same views per race in three
  versions each, the Brut animated (GIF).
* **[E]** The game must be fully playable on the phone and on the desktop.
  The playtest goes mobile-first; afterwards it finds out how an excellent
  desktop application is derived from the chosen phone views (owner,
  2026-11-23).
* **[E]** Tracking here and on the branch `claude/ux-modern-study`
  (pull request #389).

## Method [V]

* Phone views first (the owner prefers mobile-first); the desktop follows
  the chosen phone layout and is tested in a later round.
* Every situation is shown at least twice over the rounds: once with the
  three families, later with three variants inside the leading family, to
  check that the pick is stable.
* Example data are the same in every picture (three worlds, Nox attacked at
  14:32, Psikristall storage nearly full) and checked against the catalog
  (costs, storage formula).
* Mockups: `docs/design/interface-modern/render/playtest_r<n>.py` →
  `playtest/r<n>/*.jpg`; the page is `playtest/index.html`.

## The game loop [V]

Taken from the code (views, missions, reports) and the open ideas:

| # | Station | Source |
|---|---|---|
| 1 | Login & galaxy map with dashboard infos | [E] owner |
| 2 | Situation / dashboard: what happened, what runs, what the others do | #236, #189 |
| 3 | Building on fields | #158 (idea), #51 |
| 4 | Info page of a building (compact mode) | [E] owner |
| 5 | Research | catalog |
| 6 | Shipyard & defense | catalog |
| 7 | Espionage | #175, #190 |
| 8 | Send a fleet (presets?) | fleet, #388 W5 |
| 9 | Space battle & report (replay) | battle, #382 |
| 10 | Ground combat / siege | #155 (idea) |
| 11 | Debris, loot, new colony | #45, colonization |
| 12 | Guild, chat, Herold, Börse | #169, #226, #382, #386 |
| 13 | Away & notifications | #192 |

## Rounds

| Round | Stations | Situations | Status |
|---|---|---|---|
| 1 | 1–4 | s1m galaxy map · s1s own system · s2m content of the Lage sheet · s3 building on fields · s4 info page · s1n names on the map, one by one | running; s1m, s1s, s2m, s3, s4 done; version 6 (s1n, round 1b) published 2026-11-23 15:36 |
| 1b | race skins | brut · ewige: the galaxy map with the Lage sheet, three versions each, animated (GIF); Brut a membran, b chitin, c schwarm; Ewige a monolith, b uhrwerk, c gitter | published (version 6) |
| 2 | 5–7 (+ repeat of the round-1 winners) | s5 research · s6 defense on Nox · s7 espionage (queued on the page) | open |
| 3 | 8–10 | planned | open |
| 4 | 11–13 | planned | open |
| 5 | desktop derived from the chosen phone views ([E] owner) | planned | open |

Mixed order of round 1 (variant 1/2/3 → letter): s1m b·c·a (a stars with
pips, b spiral by system number, c player markers), s1s c·a·b (a orbits,
b list, c ring), s2m b·c·a (a groups, b timeline, c act now), s3 a·c·b,
s4 b·a·c (a/b/c = browser, 4X, mobile), s1n c·a·b (a names always at the
system, b from the second zoom level, c on tap). Round 1b: brut b·c·a,
ewige c·a·b. Replaced before any pick: s1 and
s2 of version 1 (galaxy without systems; dashboard not yet a sheet).

## Results

| Situation | Pick | Owner's words | Consequence |
|---|---|---|---|
| s1m galaxy map | variant 3 = a, stars with a pip per occupied position | answer: „galaxie. zoom bei klick auf ein system. das ist einfacher als raus zu zoomen.“ | **[E]** after the login the whole galaxy; a tap on a system zooms into it. **[E]** pip map. A first note (names missing, as in the player markers) was removed again before „Weiter“; s1n asks how names should appear. |
| s1s own system | variant 2 = a, orbits | answer (which infos a foreign world needs): „spieler und ob dieser aktiv ist ist glaube ich genug“ | **[E]** the system view shows the worlds on their orbits. **[E]** a foreign world shows only its player and whether the player is active. |
| s2m content of the Lage sheet | variant 1 = b, timeline | answer (what the sheet shows when pulled down): „eine zeile zeigen“ | **[E]** the Lage sheet is a timeline (events by time). **[E]** pulled down, the sheet keeps one line visible. |
| s3 building on fields (#158) | variant 2 = c, mobile: drag a building onto a field, every field shows its yield, „Bestätigen“ builds | note: „weil es sehr eindeutig erkennbar ist, welches feld ein benefit hat. und entweder zieht man die icons auf ein feld oder per click und target click“ | **[E]** while placing, every field shows clearly what it gains. **[E]** two ways to place: drag the icon onto a field, or tap the building and then tap the target field. |
| s4 info page of a building (compact mode) | variant 3 = c, mobile: big sheet with picture, one sentence of effect, costs as coloured chips, big button, swipe to the next building | note: „mir gefällt aus variante 1 besonders gut, dass dort steht, was es wann freischaltet. und bei variante zwei kriegt man gute übersichten über die stufen etc. aber wir reden hier ja über den kompaktmodus, da dürfen infos fehlen. bei einem standard modus würde ich variante 2 bevorzugen. bei variante 3 ist auch das gute, das man schnell wieder das schließen kann durch runterwischen.“ | **[E]** compact mode: the info page is a sheet (c) that closes by swiping down; information may be missing there. **[E]** standard mode: the info page is its own page with tabs and an overview of the levels (a, variant 2). **[V]** „what it unlocks and when“ (from b, variant 1) belongs into the standard page; whether the compact sheet shows it too is open. |

## Open work

* Read the remaining picks of round 1 (s1n, questions) and of round 1b.
* Build round 2 from them (stations 5–7 and a repeat of the winners).
* At the end: rewrite #388 and the design study; carry the decisions [E]
  into the feature files they concern (#158, #155, #236).
