---
type: process
title: UX playtest of the interface „Modern“
description: Blind three-way picks along the game loop with the owner as test person, to find the interface and the loop for „Modern“ (#388, #236); plan, open work and the result of every round.
---

# UX playtest of the interface „Modern“

Owner's request (2026-11-23) **[E]**: a small website that shows three
pictures of the same situation with different emphases; the owner picks the
one he likes better and writes what he likes about it; a short questionnaire
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
* **[E]** 3–4 situations per round; each situation shows three variants
  without labels, in a mixed order; the emphasis is shown after the pick.
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
| 1 | 1–4 | s1 login map · s2 dashboard · s3 building on fields · s4 info page | published 2026-11-23, waiting for picks |
| 2 | 5–7 (+ repeat of the round-1 winners) | planned after round 1 | open |
| 3 | 8–10 | planned | open |
| 4 | 11–13 | planned | open |
| 5 | desktop of the chosen layouts | planned | open |

Mixed order of round 1 (variant 1/2/3 → emphasis): s1 C·A·B, s2 B·C·A,
s3 A·C·B, s4 B·A·C.

## Results

None yet.

## Open work

* Read the picks and answers of round 1; write the result above.
* Build round 2 from them (stations 5–7 and a repeat of the winners).
* At the end: rewrite #388 and the design study; carry the decisions [E]
  into the feature files they concern (#158, #155, #236).
