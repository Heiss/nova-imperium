---
type: Architecture
title: Checks of the server actions
description: Audit of #214 - where the checks of every action in ACTIONS live (src/core, inline in the server or split), what the browser repeats, where browser and server disagree, and the follow-up pull requests per group.
tags: [architecture, actions, checks, core, audit]
status: draft
---

# Why

[Design patterns](/architecture/patterns.md), section 7: **[E]** every check
of an action is a pure function in `src/core` that returns an error code,
and the server and the browser turn the code into the German message.
Issue #214 audits this first and moves what is missing afterwards, one pull
request per group of actions; #197 had a check written twice that drifted,
fixed by moving the rank rules into `src/core/guild-ranks.ts`.

* **[V]** Taken as recommended: the audit is this concept, linked from
  section 7, not a table inside it. 33 rows with their findings and the
  plan would add about 150 lines to a file of about 860, and an agent loads
  only the concepts a task needs (`AGENTS.md`).
* **[E]** Read in the code of `main` at `8a589eb` (2026-11-15). Every cell
  of the table is [E] unless it is marked [U]. Paths are below `src/`.

# What counts

* **[V]** Taken as recommended: an action **follows section 7** when every
  rule it checks is a pure function in `src/core` (a predicate such as
  `waitsForYard` in `core/yard.ts`, or an error code such as `sendError` in
  `core/missions.ts` and `assignError` in `core/guild-ranks.ts`), the server
  only gathers the values and turns the result into its message, and the
  browser, where it repeats the check, calls the same function.
* **[V]** Taken as recommended: not counted as rules to move, because they
  need the session or the store and the browser never decides them, so they
  stay on the server:
  * authorization and lookups: `runAction` (`server/game/dispatch.ts`:
    „Unbekannte Aktion.“, „Bitte einloggen.“, `requireGuilds` with
    „Gilden sind in dieser Runde abgeschaltet.“), `mine()`
    (`server/game/actions.ts`, the own planet), `actor()` and `memberOf()`
    (`server/game/guild-ranks.ts`, the own guild), `requireAdmin()`
    (`server/game/admin.ts`);
  * the guards in SQL that keep a claim atomic in its transaction (an
    achievement once, the daily reward once a day,
    `server/game/achievements.ts`);
  * parsing of the request with `int()` and `str()`
    (`server/game/context.ts`), which clamp and trim instead of refusing.
* Status: **yes** follows section 7; **partly** some rules in `src/core`,
  the rest inline; **no** all rules inline; **none** no rule beyond those
  above.
* Messages: „–“ when the browser shows no message of its own for the check
  (it hides, disables or never sends); **no** with the finding below.

# Audit

33 actions in `ACTIONS` (19 of their own, 14 of `GUILD`). **[E]** 7 follow
section 7: 2 with their rules in `src/core` (`options`, `pushOptions`) and 5
with no rule to move (`cancelBuild`, `cancelResearch`, `read`, `delrep`,
`delall`); 13 are split and 13 check inline only.

| Action | Where its checks live | Status | Browser repeats | Messages match | Group |
|---|---|---|---|---|---|
| `build` | core `buildable`, `reqMissing`, `waitsForYard`, `waitsForLab`, `fieldsFull`, `energyShort`, `afford`; inline the running upgrade (`p.bq`), the order and the messages (`checkBuild`, `checkEnergy`, `payNextLevel`, `server/game/actions.ts`) | partly | yes, its own combination of the same predicates in another order: `buildState` (`client/logic/game.ts`), `buildingRow` (`client/logic/catalog-list.ts`) | no (F1, F2, F3, F8) | economy |
| `cancelBuild` | only the own planet; nothing to cancel is no refusal | none | – (button only while upgrading) | – | economy |
| `research` | core `reqMissing`, `labUpgrading`, `energyShort`, `afford`, `networkLab`; inline the lab above 0, the running research and the order (`checkResearch`, `checkEnergy`) | partly | yes, in another order: `researchState` (game.ts), `researchRow` and `noLab` (catalog-list.ts) | no (F2, F3, F4, F5, F9) | economy |
| `cancelResearch` | only the own planet | none | – | – | economy |
| `order` | core `reqMissing`, `unitRoom`, `maxAfford`, `yardLockedBy`; inline the yard above 0 (`requireYard`), the room, the count and at most 20 orders (`MAX_SHIPYARD_ORDERS`) | partly | partly: yard, lock, requirements, `orderMax` (`yardPage`, `unitRow`, catalog-list.ts), a count of 0 (`order` in `client/main.ts`); not the 20 orders | no (F2, F6, F7, F10) | economy |
| `pct` | inline: a producer of `PRODUCERS` only, the share rounded to tens | no | no; the select offers valid shares only (`views/ProducerTable.svelte`) | – | economy |
| `rename` | core `planetNameError` (code `empty`) and `MAX_PLANET_NAME` (`core/planet-name.ts`); the server cleans and cuts the name with `str` and words the code (`RENAME_ERROR`, `server/game/actions.ts`) (player pull request of #214) | yes | yes, silently, with core `planetNameError`: trims, sends nothing when it refuses, `maxlength` from `MAX_PLANET_NAME` (`doRename`, main.ts) | – | player |
| `options` | core `isExplainMode`; the probes clamped by `int` | yes | the same clamp, `clampInt` (`client/logic/format.ts`); the select offers the modes | – | player |
| `pushOptions` | core `isPushTopic` (`server/push-options.ts`) | yes | the boxes offer `PUSH_TOPICS` only (`client/logic/push-options.ts`) | – | player |
| `read` | – | none | – | – | player |
| `delrep` | – (deletes only a report of the player) | none | – | – | player |
| `delall` | – | none | – | – | player |
| `send` | core `missionRules`, `sendError` (codes, messages `SEND_ERROR` in `server/game/fleet-actions.ts`), `fleetSlots`, `capacity`, `fuelFor`, `canFly`; inline the unknown mission, a ship that cannot fly, no ships, the slot count (SQL `gift = 0`), cargo and fuel | partly | partly, not `sendError`: slots (`client/views/fleet.ts`), fuel and load marked red (`fleetPreview`, game.ts), hints at the target (`targetInfo`, main.ts), no probes (`gspy`, main.ts) | no (F11, F12, F13) | fleet |
| `recall` | inline: own, on the way out, not yet arrived, no gift (`recall`) | no | partly: own, out, no gift (`fleetRow`, `client/logic/overview.ts`); not the arrival | – (F14) | fleet |
| `settings` | core `validateUniverse` (`core/universe.ts`), which returns German messages, not codes | partly | no; the inputs show the range of each setting (`client/views/misc.ts`) | – | admin |
| `reset` | inline: both reward choices and the guild switch are booleans (`rewardRules`, `guildRule`, `server/game/round.ts`) | no | – (checkboxes send booleans) | – | admin |
| `endzeit` | inline: once per round, whole minutes within `GIFT_MINUTES` of `core/endzeit.ts` (`flightMinutes`, `server/game/endzeit.ts`) | no | partly: no button once done (`endzeitBox`, misc.ts); the minutes carry `min` and `max` in no form | no (F15) | admin |
| `claimAchievement` | inline: achievements on, a known id, a home planet, progress at the target; once by SQL | no | yes, written again: `statusOf` (`client/views/achievements.ts`) | – | rewards |
| `claimDailyReward` | inline: daily rewards on, a home planet; once a day by SQL | no | the flag `claimed` of the state | – | rewards |
| `createGuild` | inline: no guild or application, `profile()` (tag `[A-Z0-9]{2,8}` after upper case, name 3 to 32, text at most 6,000, tag or name taken; `server/game/guilds.ts`) | no | partly: the form only without a guild, `minlength` and `maxlength` (`client/views/guilds.ts`); not the characters of the tag | no (F16) | guild |
| `updateGuild` | inline: right `profile` (`need`), `profile()` | no | partly: the form only with the right, the same attributes | no (F16) | guild |
| `applyToGuild` | inline: no guild or application, the guild exists | no | the button only without a guild | – | guild |
| `reviewGuildApplication` | inline: right `applications`, the application is open | no | the list only with the right | – | guild |
| `leaveGuild` | inline: in a guild; the Leitung only without other members („Übergib zuerst die Gildenleitung.“), and then the guild is dissolved | no | the Leitung gets „Gilde auflösen“ instead of „Gilde verlassen“ | – | guild |
| `manageGuildMember` | core `isBelow`, `memberPlace`, `belowLeitung`; inline right `remove`, the hand-over by the Leitung only, not oneself | partly | yes, with core `isBelow` and `memberPlace` (`memberControls`) | – | guild |
| `createGuildRank` | core `rankNameError`, `MAX_GUILD_RANKS`; inline right `ranks` | partly | partly: the form only with the right and below 25 ranks; the name only by `maxlength` (F17) | – | guild |
| `renameGuildRank` | core `rankNameError`, `isBelow`; inline right `ranks` (`managed`) | partly | partly: the editor only with the right and below; the name as F17 | – | guild |
| `setGuildRankRights` | core `isGuildRight`, `canChangeRights`, `isBelow`; inline right `ranks` | partly | yes, inline: a box of a right the own rank lacks is disabled (`rankEditor`), the rule of `canChangeRights` | – | guild |
| `moveGuildRank` | core `isBelow`; inline the neighbour exists | partly | yes: up only when `isBelow(me.at, at - 1)`, down not on the last rank; the browser takes the index in the list, the server the stored position, both ordered by position | – | guild |
| `deleteGuildRank` | core `deleteError`, `isBelow`; inline not the default rank, right `ranks` | partly | yes, with core `deleteError` | – | guild |
| `setGuildDefaultRank` | core `belowLeitung`; inline the Leitung only | partly | yes: the Leitung, not the first rank, not the default | – | guild |
| `assignGuildRank` | core `assignError` (codes `lower` and `rights`); inline right `assign` | partly | yes, with core `assignError` (`rankChange`) | – | guild |
| `dissolveGuild` | inline: the Leitung only, the tag equal without case | no | partly: the button only for the Leitung, the tag `required` | – | guild |

# Findings: browser and server disagree

**[E]** Found by the audit and not fixed here (#214: the follow-up pull
requests change no behaviour either). The owner decided on 2026-11-15
(O18 (c), [Open points](/open-points.md)) to unify only the real
contradictions F10, F12, F15 and the order of F8 and F9, after the economy
pull request; the other findings stay as they are. Server paths are below
`src/server/game/`, browser paths below `src/client/`; „message“ is a
different text for the same check, „rule“ a different check.

* **F1** (message) Build waits: `actions.ts:119` „Es wird bereits
  gebaut.“, `:122` „Die Schiffsschmiede arbeitet gerade.“, `:123` „Das
  Scholarium forscht gerade.“; the browser `logic/catalog-list.ts:240-242`
  „Bauschleife belegt“, „Schiffsschmiede arbeitet gerade“, „Scholarium
  forscht gerade“.
* **F2** (message) Requirements: `actions.ts:121`, `:186` and `:250` „Das
  Wissen ist noch verschlossen.“; `logic/catalog-list.ts:157` without the
  full stop. Within the browser „Keine freien Felder.“ (`:243`) has one.
* **F3** (message) Energy: `actions.ts:107` „Zu wenig Energie: ‹Name›
  braucht eine Energieproduktion von ‹Bedarf›, es fehlen ‹Fehlbetrag›.“;
  `logic/catalog-list.ts:167` „Zu wenig Energie: es fehlen ‹Fehlbetrag›“
  (the row shows the need in its energy line).
* **F4** (message) Research waits: `actions.ts:183` „Es wird bereits
  geforscht.“, `:184` „Das Scholarium wird ausgebaut.“;
  `logic/catalog-list.ts:313-314` „Es wird bereits geforscht“, „Scholarium
  wird ausgebaut“.
* **F5** (message) No lab: `actions.ts:182` „Du brauchst ein Scholarium.“;
  `logic/catalog-list.ts:381-383` „Für Forschung brauchst du ein
  Scholarium.“, or the hint to another own planet with one.
* **F6** (message) No shipyard: `actions.ts:239` „Du brauchst eine
  Orbitale Schiffsschmiede.“; `logic/catalog-list.ts:485` „Dafür brauchst
  du eine Orbitale Schiffsschmiede.“
* **F7** (message) Shipyard lock: `actions.ts:241` „Die ‹Gebäude› wird
  ausgebaut.“; `logic/catalog-list.ts:469-472` „Die Schiffsschmiede wird
  gerade ausgebaut und kann nicht produzieren.“ or „Die ‹Gebäude› wird
  gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.“
* **F8** (rule) Order of the build checks: the server `actions.ts:117-127`
  place, running upgrade, requirements, shipyard, lab, fields, energy; the
  browser `logic/game.ts:62-88` requirements, fields, running upgrade,
  shipyard, lab, energy. For another building while an upgrade runs on a
  planet without a free field, the server says „Es wird bereits gebaut.“
  and the browser shows „Keine freien Felder.“
* **F9** (rule) Order of the research checks: the server
  `actions.ts:181-187` lab, running research, lab upgrade, requirements,
  then energy (`:203`); the browser `logic/game.ts:94-107` requirements
  first, then running research, lab upgrade, energy.
* **F10** (message) An order of 0: the browser `main.ts:1190` „Bitte eine
  Anzahl eingeben.“; the server, for `n` 0, `actions.ts:251-255` „Der
  Zehnte reicht nicht aus.“
* **F11** (rule) Cargo: the browser marks the load red from the numbers
  typed in (`main.ts:994-996`, `logic/game.ts:138` and `:146`); the server
  first cuts Adamant and Psikristall to the stock of the planet
  (`fleet-actions.ts:82-83`) and then checks the hold (`:168-169`). Adamant
  typed beyond the stock can mark the load red where the server sends the
  fleet with the stock.
* **F12** (message) An Auspex-Erkundung from the Sternenkarte without
  probes: `main.ts:1243-1247` „Keine Spähschädel auf dem Planeten.“; the
  server `fleet-actions.ts:124-125` „Keine Schiffe ausgewählt.“
* **F13** (message) All slots used: `views/fleet.ts:63` „Alle Flottenslots
  belegt (Kogitator-Doktrin erhöht die Anzahl).“; `fleet-actions.ts:126-127`
  „Alle Flottenslots belegt.“ The rule itself, no slot for the gift of the
  Endzeit, is written twice and the same: `!f.gift` in `views/fleet.ts:70`
  and `gift = 0` in `src/server/db/repos/fleets.ts:75`.
* **F14** (rule) Recall: the browser offers „Rückruf“ for an own fleet on
  the way out without a gift (`logic/overview.ts:114`), also after its
  arrival time until the next state; the server then refuses „Rückruf
  nicht mehr möglich.“ (`fleet-actions.ts:218-219`).
* **F15** (message and rule) Endzeit: done, `views/misc.ts:128` „In dieser
  Runde wurde die Endzeit schon eingeläutet.“ and `endzeit.ts:101` „Die
  Endzeit wurde in dieser Runde schon eingeläutet.“; the minutes carry
  `min` and `max` (`views/misc.ts:137`) in no form, so the browser does
  not check them, and the server refuses with „Bitte eine Flugzeit von 1
  bis 4.320 Minuten (72 h) eingeben.“ (`endzeit.ts:55`).
* **F16** (message and rule) Guild profile: `views/guilds.ts:35-38` checks
  the lengths before trimming with `minlength` and `maxlength`, so the
  browser shows its own message [U: in the language of the browser, not
  checked], and allows any characters in the tag; the server
  (`guilds.ts:25-33`) trims, upper-cases the tag, allows only letters and
  digits, and answers in German.
* **F17** (rule) Rank names: `views/guilds.ts:219` and `:245` carry
  `minlength`, but the inputs sit in no form and `main.ts` calls no
  `checkValidity`, so only `maxlength` holds; the server refuses with „Der
  Rangname braucht 2 bis 67 Zeichen.“ (`guild-ranks.ts:110`).

Checks only the server makes, besides those of „What counts“: the 20 orders
of the shipyard (`actions.ts:52` and `:256-257`; the browser leaves „Bauen“
enabled, `logic/catalog-list.ts:451`), `sendError` (the browser only hints
at a missing planet or Trümmerfeld), the universe settings, the tag and name
taken, and every rule of `claimDailyReward` beyond the state.

Notes, no disagreement:

* Numbers written into messages beside their constant in `src/core`:
  „2 bis 67“ (`guild-ranks.ts:110`, `MIN_RANK_NAME`, `MAX_RANK_NAME`),
  „25“ (`guild-ranks.ts:131`, `MAX_GUILD_RANKS`), „1 bis 4.320“
  (`endzeit.ts:55`, `GIFT_MINUTES`).
* `actions.ts:253` „Diesen Schutzdom gibt es nur einmal pro Planet.“ is the
  message of every unit with the component `limit`; only the two shield
  domes have one (`src/features/ssd`, `src/features/lsd`).
* `validateUniverse` returns German messages with the range of each
  setting, not codes.

# Open pull requests

**[E]** Read on their branches on 2026-11-15; this audit counts `main`
only.

* #216, guild chat (`claude/guild-chat` at `0e893cf`), adds
  `sendGuildChat`, `deleteGuildChat` and `seeGuildChat` to `GUILD`. Mostly
  section 7, split like the other guild actions: the text rule
  `chatTextError` (codes `empty`, `length`), `canDeleteChat`,
  `CHAT_INTERVAL` and `MAX_CHAT_TEXT` are pure in `src/core/guild-chat.ts`;
  inline are the rights (`need`), the pause between two messages, and that
  the message exists and is no event. The browser takes `MAX_CHAT_TEXT` for
  `maxlength` and the flag `delete` per message, which the server computes
  with `canDeleteChat`.
* #217, Auspex-Phalanx (`claude/moons-pr2-phalanx` at `ce3098a`), adds
  `scan`. Follows section 7: `scanError` in `src/core/phalanx.ts` returns a
  code, the price included, and `server/game/phalanx.ts` turns it into the
  message (`SCAN_ERROR`); the browser offers the scan with `canScan`
  (`client/logic/phalanx.ts`), which calls `scanReach`, the same check
  without the price (owner, 2026-11-15). Inline is only the parsing of the
  target („Unbekanntes Ziel.“).

# Plan

* **[V]** Taken as recommended (consistent with section 7 and #214): one
  pull request per group, in this order, each without a change of
  behaviour, with unit and property tests per check, the existing unit and
  E2E tests unchanged, a mutation score of at least 80 for every new core
  file, an OKF update and `kein-changelog`:
  1. **Economy** (`build`, `research`, `order`, `pct`; `cancelBuild` and
     `cancelResearch` need nothing): the browser repeats the most here, and
     each side combines the same predicates in its own order (F8, F9).
  2. **Fleet** (`send`, `recall`): the ships, slots, cargo and fuel beside
     `sendError`, the recall, the slot rule once (F13); after #216, which
     changes `fleet-actions.ts`.
  3. **Rewards** (`claimAchievement`, `claimDailyReward`): the status of an
     achievement once for the server and `statusOf`; the SQL guards stay.
  4. **Admin** (`settings`, `reset`, `endzeit`): codes for
     `validateUniverse`, the Endzeit once per round and its minutes.
  5. **Player** (`rename`; `options` and `pushOptions` already follow, the
     others need nothing).
  6. **Guild** (the 14 actions and the chat of #216): after #216 is merged,
     because it changes `guilds.ts`, `guild-ranks.ts` and the guild view.
* **[V]** Taken as recommended: each check becomes one function in
  `src/core` that returns its code or null; its predicates stay its parts.
  The server keeps its messages and the browser its notes, each from a
  table of the codes. Where their order differs (F8, F9), the function
  returns every code that applies, in the order of the server: the server
  takes the first, the browser the first in its own order. So the findings
  stay as they are, except the ones O18 (c) unifies (owner, 2026-11-15).
* **[V]** The checks of „What counts“ stay on the server; the table above
  names why.
