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

**[E]** Since the economy pull request of #214 (2026-11-16): 11 follow
section 7, the four economy actions `build`, `research`, `order` and `pct`
too; 10 are split and 12 check inline only. Their rows below are the state
after it; the other rows are the audit of 2026-11-15.

**[E]** Since the admin pull request and the guild, player, rewards and
fleet groups of #214 (2026-11-21): all 33 actions of the audit follow
section 7; `send` but for the joining of an attack union (#225, after the
audit, its row). Their rows below are the state after them.

**[E]** The vacation mode (#223, 2026-11-17) adds `startVacation` and
`endVacation`, both following section 7, and one gate before every
action: `runAction` refuses an action with „Im Urlaubsmodus nicht
möglich.“ when core `vacationRefuses` (`core/vacation.ts`) says so for a
player in vacation mode. Since 2026-11-18 only `endVacation` and
`pushOptions` pass it; every other action is refused, the guild actions,
`options`, `rename`, `mainPlanet`, `read`, `delrep`, `delall`, `jump`
(#230), `abandon` (#224) and the admin's actions too, and one added later
as well (a test runs every key of `ACTIONS`). The browser does not offer
them: it shows the lock screen (`views/vacation-lock.ts`) for the state
the server sends to such a player (`lockedState`, `server/game/state.ts`).
The password change, the deletion of the account, the passkeys, the push
routes and the sign-out are routes, not actions, and stay open. `send` gets
the code `vacation` of `sendError`. **[E]** Since 2026-11-18 (owner) an
account in vacation mode records no activity (`recordActivity` returns at
once; `endVacation` records again) and every admin route `/api/admin/…` is
refused for an admin in vacation mode with „Im Urlaubsmodus nicht möglich.“,
by the one guard `admin()` of `src/server/http/admin.ts`. **[V]** The game
options action `options` is refused in vacation mode like every action off
the allow list.

Since the Warp-Tor (#230, 2026-11-17) `ACTIONS` also has `jump`, which
follows section 7; its row is below `recall`. Since #202 (2026-11-17) it
also has `demolish`, which follows section 7 from its start; its row is
below `cancelBuild`. Since #258 (2026-11-19) it also has `cancelOrder`, which takes
an order of the shipyard back; its row is below `order`. The counts above are those
of the audit and stay.

| Action | Where its checks live | Status | Browser repeats | Messages match | Group |
|---|---|---|---|---|---|
| `build` | core `buildErrors` (`core/economy-checks.ts`: codes `place`, `locked`, `full`, `busy`, `yardBusy`, `labBusy`, `noEnergy`, `cost` from `buildable`, `reqMissing`, `fieldsFull`, `waitsForYard`, `waitsForLab`, `energyShort`, `afford`); the server only the messages (`BUILD_ERROR`, `PLACE_ERROR`, `failEnergy`, `server/game/actions.ts`) | yes | yes, with core `buildErrors` in the same order (F8 fixed): `buildState` (`client/logic/game.ts`), the notes `BUILD_WAITS` of `buildingRow` (`client/logic/catalog-list.ts`) | no (F1, F2, F3) | economy |
| `cancelBuild` | only the own planet; nothing to cancel is no refusal | none | – (button only while upgrading) | – | economy |
| `demolish` (#202) | core `demolitionErrors` (`core/demolition.ts`: codes `place`, `none`, `fields`, `busy`, `yardBusy`, `labBusy`, `cost` from `maxFields`, `usedFields`, `waitsForYard`, `waitsForLab`, `afford`); the server only the messages (`DEMOLITION_ERROR`, `server/game/demolition.ts`) | yes | yes, with core `demolitionErrors`: the button „Zurückbauen“ only without `place`, `none` and `busy` (`canOfferDemolition`), the confirmation names the first other code (`demolitionDialog`, `client/logic/demolition.ts`) | yes, one text per code (`DEMOLITION_NOTE`, kept equal by `src/test/demolition-texts.test.ts`) | economy |
| `research` | core `researchErrors` (codes `noLab`, `locked`, `busy`, `labUpgrading`, `noEnergy`, `cost` from `hasLab`, `reqMissing`, `labUpgrading`, `energyShort`, `afford`); `networkLab` only for the time; the server only the messages (`RESEARCH_ERROR`, `failEnergy`) | yes | yes, with core `researchErrors` in the same order (F9 fixed): `researchState` (game.ts), the notes `RESEARCH_WAITS` of `researchRow`; the page without a lab with core `hasLab` and `noLab` (catalog-list.ts) | no (F2, F3, F4, F5) | economy |
| `cancelResearch` | only the own planet | none | – | – | economy |
| `order` | core `orderErrors` (codes `noYard`, `yardLocked`, `locked`, `count`, `limit`, `cost`, `queueFull` from `hasYard`, `yardLockedBy`, `reqMissing`, `unitRoom`, `maxAfford` and at most 20 orders); the server only the messages (`ORDER_ERROR`, the lock with `YARD_LOCK`) | yes | partly, with core `orderErrors` in its own order: the requirements first, then the lock, the limit and the price disable „Bauen“ (`orderAction`, catalog-list.ts), the page with core `hasYard` (`yardPage`), a count of 0 by `orderNote` (`order` in `client/main.ts`); not the 20 orders | no (F2, F6, F7) | economy |
| `cancelOrder` (#258) | inline: the position must be a whole number from 0 (else „Ungültig.“); only the own planet; the rule is core `cancelOrder` (`core/cancel-order.ts`); a position that holds no order or another unit changes nothing and is no refusal, as `cancelBuild` without an upgrade | none | – (a button per order of the list, `cancelOrder` of `client/features/queue.ts`) | – | economy |
| `pct` | core `isProducer` (a producer of `PRODUCERS` only); the share rounded to tens after `int()`, a clamp, not a refusal | yes | no; the select offers valid shares only (`views/ProducerTable.svelte`) | – | economy |
| `rename` | core `planetNameError` (`core/planet-name.ts`: code `empty`) for the name after `str(…, MAX_PLANET_NAME)` (20); the server words it (`RENAME_ERROR`, `server/game/actions.ts`), the planet by `mine()` after the name (player pull request of #214) | yes | yes, silently, with core `planetNameError`: trims, sends nothing while it refuses, `maxlength` of `MAX_PLANET_NAME` (`doRename`, `client/features/rename.ts`) | – | player |
| `options` | core `isExplainMode`; the probes clamped by `int` | yes | the same clamp, `clampInt` (`client/logic/format.ts`); the select offers the modes | – | player |
| `pushOptions` | core `isPushTopic` (`server/push-options.ts`) | yes | the boxes offer `PUSH_TOPICS` only (`client/logic/push-options.ts`) | – | player |
| `abandon` (#224, after the audit) | core `abandonTargetError` (codes `unknown`, `moon`, `main`) and `abandonError` (then `stale`, a confirmation opened for an earlier colony at the same position by its founding time `created` (owner, 2026-11-17), then `flights`, `research`, `orders`, `core/abandon.ts`); the server words them (`ABANDON_ERROR`, `server/game/abandon.ts`); the password before them, inline like the deletion of the account („What counts“: the session), and the address limited | yes | partly, with core `abandonTargetError`: the button „Kolonie aufgeben“ only on an own planet that is not the main planet (`abandonOffered`, `client/logic/abandon.ts`); the references only the server; the Sternenkarte offers no Landnahme at a locked position, with core `positionLocked` (`freePosition`) | – | player |
| `startVacation` | core `vacationEntryError` (codes `fleets`, `building`, `research`, `shipyard`, `core/vacation.ts`); the server gathers what runs and words the codes (`VACATION_ENTRY_ERROR`, `server/game/vacation.ts`) (#223) | yes | no; the box „Urlaubsmodus“ names what blocks the entry (`client/logic/vacation.ts`) | – | player |
| `endVacation` | core `vacationExitError` (codes `inactive`, `early`); the server words them (`earlyText` with the earliest end) (#223) | yes | yes, with core `vacationEnd`: on the lock screen „Urlaubsmodus beenden“ disabled before the end, with the time left in text (`lockLeft`, `client/logic/vacation.ts`) | – | player |
| `read` | – | none | – | – | player |
| `delrep` | – (deletes only a report of the player) | none | – | – | player |
| `delall` | – | none | – | – | player |
| `send` | core `startError` (`core/fleet-checks.ts`: codes `mission` for a mission that is not one of the fleet form, `stationary` from `canFly`, `noShips`, or `noProbes` for an Auspex-Erkundung or a Vermessung from the field `withoutShips` of its rules (F12, F19), `slots` from `fleetSlots` against the used slots, SQL `gift = 0`), then core `missionRules`, `sendError` (codes, messages `SEND_ERROR` in `server/game/fleet-actions.ts`; after the audit the code `locked` of #224, worded with the end of the lock by `positionLockedText`, `server/game/position-lock.ts`, and since #223 the code `vacation` from `vacationProtects`, `core/vacation.ts`; since #175 the Auspex-Erkundung refuses below Auspex-Lehre 1 with `noSpyTech` of `spyTechError`, `core/espionage.ts`, from the sender's research in `SendFleet`; #190 added `surveyLocked` and `surveyProbesOnly` of the Vermessung, which reads the research of the owner from `SendFleet` and whose position lock is refused too; since #95 the Mondbruch refuses with `notMoon` (target kind `foreignMoon`, asked first) and `noWorldbreaker`, after the same `vacation` and noob protection checks as a foreign target; #93 added the target kind `expedition` (the position after the last planet position, `SendTarget.expedition` from `isExpeditionPlace`) with `notExpedition`, `expeditionLocked` and `expeditionSlots` (the research and the running expeditions from `SendFleet`) and `expeditionSpace` for a free-position mission there, with the extra places of the round from `SendFleet.extraSlots`), then core `holdTimeError` (code `holdTime` of a Halten, #55), `stayError` (code `stay`, the hours of `maxStay`, #93; the server names the hours), and `cargoError` (codes `hold` from `capacity`, `fuel` from `fuelFor` and the Promethium loaded); the server gathers the picked ships, the slots, the cargo cut to the stock and the fuel and words the codes (`FLEET_ERROR`) (fleet pull request of #214). Not part of it: the joining of an attack union (#225, after the audit), checked partly inline by `joinPlan` (`server/game/union.ts`) between the stay and the cargo | yes, but the attack union | partly, not the core checks: slots (`client/views/fleet.ts`), fuel and load marked red (`fleetPreview`, game.ts), hints at the target (`targetInfo`, main.ts), no probes (`gspy`, `client/features/galaxy.ts`); not `noSpyTech` (#175) | no (F11, F13; F12 and F19 unified) | fleet |
| `recall` | core `recallError` (`core/fleet-checks.ts`: codes `gone` for no own fleet or one that `recallable` no longer takes, then `gift` (#161), then `gone` for missiles by `isFleet`, #54); the server words them (`FLEET_ERROR`) (fleet pull request of #214); the way home is `min(flown so far, flight out)` since #93 | yes | partly: own, out, no gift (`fleetRow`, `client/logic/overview.ts`); not the arrival | – (F14) | fleet |
| `jump` | core `jumpError` (`core/jump-gate.ts`: codes `notMoon`, `noGate`, `cooling`, `noTarget`, `sameMoon`, `targetNoGate`, `targetCooling`, `noShips`, `stationary` from `gateLevel`, `gateReady`, `targetError` and `canFly`); the server only gathers the two moons, their gate times and the picked ships (`pickedShips` of `fleet-actions.ts`, at most the ships there) and words the codes (`JUMP_ERROR`, `server/game/jump-gate.ts`) | yes | yes, with core `gateReady` and `targetError`: „Springen“ disabled while the own gate cools down or no target is ready, a cooling target disabled in „Zielmond“, foreign and gateless moons not offered (`jumpPanel`, `client/logic/jump-gate.ts`); not the ships, which the server refuses („Keine Schiffe ausgewählt.“) | – | fleet |
| `missile` | core `launchError` (`core/missiles.ts`: codes `count`, `noMissiles`, `aim`, `noPlanet`, `noMoon`, `ownTarget`, `outOfRange`, `vacation` from `vacationProtects` and `protected` from the noob protection); the server gathers the launcher, the target and its owner and words the codes (`LAUNCH_ERROR`, `server/game/missiles.ts`); a player in vacation mode is refused by the general gate | yes | partly: the button „Raketenangriff“ only with Orbitalraketen and a target in range (`canLaunch`, `client/logic/missiles.ts`); the rest the server refuses | – | fleet |
| `trade` (#171, after the audit) | core `trade` (`core/market.ts`: codes `closed`, `noPost`, `resource`, `amount`, `poor`, `full`, `limit`, `tiny` from `marketOpen`, `postLevel`, `pairOf`, the whole amount, the stock, `roomFor`, `remaining`, `got`; the fee from `feePercent` with the two settings of the round); the cap by the free storage is applied first, then an amount above what is left of the day is cut to it (`cut`, owner 2026-11-19; only an empty rest refuses with `limit`; a limit of 0 is none); the server gathers the planet, the prices after the drift and the amount of the UTC day (`marketOf`, `server/game/market.ts`) and words the codes with `tradeNote` (`core/market-text.ts`, shared with the browser); one transaction: stock, price of the pair (`market_prices`) and amount of the day (`market_usage`) change together; own planet by `mine()`; not on the vacation allow list (#223) | yes | yes, with core `trade`: `preview` shows the refusal as a note and disables „Tauschen“ (`client/logic/market.ts`), „max“ from `maxGive`; the same words | – | economy |
| `settings` | core `universeErrors` (codes `range` and `used` per setting, in the order of `UNIVERSE_SPECS`) and `universeOf` (`core/universe.ts`); the server words each code (`SETTINGS_ERROR`, `server/game/admin.ts`), every refused setting at once (admin pull request of #214) | yes | no; the inputs show the range of each setting (`client/views/misc.ts`) | – | admin |
| `reset` | core `roundRefused` and `roundValues` over the registry `ROUND_SETTINGS` (`core/round.ts`, #283): the first refused setting in the fixed order of the registry (`order`, owner, 2026-11-17: rewards, guilds, main-planet lock, lock of a given-up position, then the entries of later features by their numbers, among them who may hold and the level of the spy report of #55 and the refund factor and time of a demolition of #202), a group (`rewards`) together; the server words it with the entry's `refusal`, else `rangeError` (`server/game/round.ts`) (admin pull request of #214); after the audit the locks of #221 (`core/main-planet.ts`) and #224 (`core/abandon.ts`) and the refund factor and the time of a demolition of #202 (`core/demolition.ts`) are entries of it, each file exporting its entries as `roundSettings` (#310) | yes | – (checkboxes send booleans) | – | admin |
| `endzeit` | core `endzeitError` (codes `done`, then `minutes`: whole minutes within `GIFT_MINUTES`, `core/endzeit.ts`); the server words them (`ENDZEIT_ERROR`, `server/game/endzeit.ts`) (admin pull request of #214) | yes | yes, with core `endzeitError`: no button once done (`endzeitBox`, misc.ts), the dialog sends nothing with a wrong time (`endzeitNote`, `client/logic/endzeit.ts`) | yes (F15 unified) | admin |
| `claimAchievement` | core `claimError` (`core/reward-checks.ts`: codes `off`, `unknown` by `achievementOf`, `planet`, `open` by `reached`); the server gathers the planet and the progress in that order and words the codes (`CLAIM_ERROR`, `server/game/achievements.ts`); once by SQL (rewards pull request of #214) | yes | yes, with core `achievementStatus` (`reached`, the claimed ids): the groups of the page (`client/logic/achievements.ts`) | – | rewards |
| `claimDailyReward` | core `dailyError` (`core/reward-checks.ts`: codes `off`, `planet`); the server words them (`DAILY_ERROR`); once a day by SQL (rewards pull request of #214) | yes | the flag `claimed` of the state | – | rewards |
| `createGuild` | core `createGuildError` (`core/guild-checks.ts`: codes `member`, then `tag`, `name`, `text`, `taken` of `profileError`: tag `[A-Z0-9]{2,8}` after upper case, name 3 to 32, text at most 6,000, tag or name of another guild taken); the server gathers the profile as sent (`str`, upper case, trimmed), whether the player has a guild or an application and whether the tag or name is taken, and words the codes (`JOINED`, `PROFILE_ERROR`, `server/game/guilds.ts`) | yes | partly: the form only without a guild, `minlength` and `maxlength` as literals (`GuildProfileForm.svelte`); not the characters of the tag | no (F16) | guild |
| `updateGuild` | the actor by `actor()`, then core `updateGuildError` (codes `right` for `profile`, then those of `profileError`; the own tag and name are no other guild's) | yes | partly: the form only with the right, the same attributes | no (F16) | guild |
| `applyToGuild` | core `applyError` (codes `member`, `guild`); the server words them | yes | the button only without a guild | – | guild |
| `reviewGuildApplication` | the actor, then core `reviewError` (codes `right` for `applications`, `application`: an open application to the own guild) | yes | the list only with the right | – | guild |
| `leaveGuild` | core `leaveError` (codes `none`, `handover`: the Leitung only without other members, and then the guild is dissolved) | yes | the Leitung gets „Gilde auflösen“ instead of „Gilde verlassen“ | – | guild |
| `manageGuildMember` | the actor, then core `manageMemberError` (codes `member`: not a member of the guild or oneself; for the hand-over `lead`, `rank`, `leitung` of `defaultRankError`; else `right` for `remove`, `lower` of `isBelow`) | yes | yes, with core `manageMemberError` for „Entfernen“ and `isBelow`, `memberPlace` (`memberControls`, `client/logic/guilds.ts`) | – | guild |
| `createGuildRank` | core `createRankError` (codes `right` for `ranks`, `full` at `MAX_GUILD_RANKS`, then `length`, `taken` of `rankNameError`; the first two as `rankRoomError`) | yes | partly: the form with `rankRoomError`; the name only by `maxlength` (F17) | – | guild |
| `renameGuildRank` | core `renameRankError` (`managedError`: codes `right`, `rank`, `lower`; then `length`, `taken`) | yes | partly: the editor with `managedError`; the name as F17 | – | guild |
| `setGuildRankRights` | core `rightsError` (`managedError`, then `unknown` for a right that does not exist, then `change` by `canChangeRights`) | yes | yes, inline: a box of a right the own rank lacks is disabled (`rankEditor`), the rule of `canChangeRights` | – | guild |
| `moveGuildRank` | core `moveRankError` (`managedError`, then `end` without a neighbour, `lower` when the neighbour is not below the actor) | yes | yes, with core `moveRankError` (`up`, `down` of `rankEditor`) | – | guild |
| `deleteGuildRank` | core `deleteRankError` (`managedError`, then `default`, then `members` by `deleteError` for the default rank that takes the members) | yes | yes, with core `deleteRankError` | – | guild |
| `setGuildDefaultRank` | core `defaultRankError` (codes `lead`, `rank`, `leitung`) | yes | yes, with core `defaultRankError` (`makeDefault`) | – | guild |
| `assignGuildRank` | core `assignRankError` (codes `right` for `assign`, `member`, `rank`, then `lower` and `rights` of `assignError`) | yes | yes, with core `assignRankError` (`rankChange`) | – | guild |
| `dissolveGuild` | core `dissolveError` (codes `lead`, `tag`: equal without case) | yes | partly: the button only for the Leitung, the tag `required` | – | guild |
| `sendGuildChat` (#169, after the audit) | the actor, then core `sendChatError` (`core/guild-chat.ts`: codes `right` for `chat-write`, `empty`, `length` of `chatTextError` for the text cleaned by `clean`, then `wait` within `CHAT_INTERVAL` of the member's last message); the server words them (`SEND_ERROR`, `server/game/guild-chat.ts`) | yes | partly: `maxlength` of `MAX_CHAT_TEXT`; the box only with the right | – | guild |
| `deleteGuildChat` (#169, after the audit) | the actor, then core `deleteChatError` (codes `right` for `chat-delete`, `message`: of the own guild, `event`, `lower` by `canDeleteChat`); the server words them | yes | yes, with core `deleteChatError`: the flag `delete` of each message of the state | – | guild |
| `seeGuildChat` (#169, after the audit) | the actor, then core `seeChatError` (code `right` for `chat-read`) | yes | – (sent only while the chat is open) | – | guild |
| `requestFriend` (#227) | core `friendError` (codes `unknown`, `self`, `friends`, `outgoing`, `incoming`) with `relationOf` (`core/friends.ts`); the server words them (`FRIEND_ERROR`, the crossed request with the name, `server/game/friends.ts`); the name parsed by `str` | yes | – (the browser sends nothing without a name, `friendCall`, `client/logic/friends.ts`) | – | friends |
| `answerFriend` (#227) | core `friendError` (`unknown`, `self`, `noRequest`) | yes | – (buttons only at a request to the player) | – | friends |
| `cancelFriend` (#227) | core `friendError` (`unknown`, `self`, `noRequest`) | yes | – (button only at an own request) | – | friends |
| `removeFriend` (#227) | core `friendError` (`unknown`, `self`, `noFriend`) | yes | – (button only at a friend, after the question „Freundschaft beenden?“) | – | friends |

* **[V]** The four actions of the buddy list (#227) came after the audit
  and follow section 7 from the start; the counts above stay those of the
  audit.

# Findings: browser and server disagree

**[E]** Found by the audit and not fixed here (#214: the follow-up pull
requests change no behaviour either). The owner decided on 2026-11-15
(O18 (c), [Open points](/open-points.md)) to unify only the real
contradictions F10, F12, F15 and the order of F8 and F9, after the economy
pull request; the other findings stay as they are. Server paths are below
`src/server/game/`, browser paths below `src/client/`; „message“ is a
different text for the same check, „rule“ a different check. The line
numbers are those of the audit (`8a589eb`).

**[E]** The economy pull request of #214 (2026-11-16) fixed F8, F9 and
F10, the economy findings among those O18 (c) unifies (owner, 2026-11-15);
F12 belongs to the fleet group and F15 to the admin group. **[E]** F15 was
unified by the admin pull request, F12 by the fleet pull request of #214
(owner, 2026-11-21, Q2 (a): the browser's text on both sides). F1 to F7 stay:
the browser keeps its notes and the server its messages, each from a table
of the codes. [U: O18 says „after the economy pull request“; the task of
the loop read it as „with the economy checks in place“ and unified F8, F9
and F10 in that pull request.]

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
  and the browser shows „Keine freien Felder.“ **Fixed:** one order,
  `buildErrors` in `src/core/economy-checks.ts`: place, requirements,
  fields, running upgrade, shipyard, lab, energy, price. **[V]** Taken as
  recommended: the order of the browser, the place first as on the server
  (the list shows only what stands on the place). So no note of the browser
  changes; the server answers a refusal the interface never sends with
  another existing message (above: „Keine freien Felder.“).
* **F9** (rule) Order of the research checks: the server
  `actions.ts:181-187` lab, running research, lab upgrade, requirements,
  then energy (`:203`); the browser `logic/game.ts:94-107` requirements
  first, then running research, lab upgrade, energy. **Fixed:** one order,
  `researchErrors`: lab, requirements, running research, lab upgrade,
  energy, price. **[V]** Taken as recommended, as F8: the order of the
  browser, the lab first as on the server (without a lab the browser shows
  no list). Changed on the server only: „Das Wissen ist noch
  verschlossen.“ instead of „Es wird bereits geforscht.“ or „Das Scholarium
  wird ausgebaut.“ for a research whose requirements are missing.
* **F10** (message) An order of 0: the browser `main.ts:1190` „Bitte eine
  Anzahl eingeben.“; the server, for `n` 0, `actions.ts:251-255` „Der
  Zehnte reicht nicht aus.“ **Fixed:** the code `count` of `orderErrors`
  after the requirements; the server answers with the browser's text
  „Bitte eine Anzahl eingeben.“, the browser asks the same code
  (`orderNote`).
* **F11** (rule) Cargo: the browser marks the load red from the numbers
  typed in (`main.ts:994-996`, `logic/game.ts:138` and `:146`); the server
  first cuts Adamant and Psikristall to the stock of the planet
  (`fleet-actions.ts:82-83`) and then checks the hold (`:168-169`). Adamant
  typed beyond the stock can mark the load red where the server sends the
  fleet with the stock.
* **F12** (message) An Auspex-Erkundung from the Sternenkarte without
  probes: `main.ts:1243-1247` „Keine Spähschädel auf dem Planeten.“; the
  server `fleet-actions.ts:124-125` „Keine Schiffe ausgewählt.“
  **[E]** Unified by the fleet pull request of #214 (owner, 2026-11-21, Q2
  (a)): browser and server use the browser's text. The code `noProbes` of
  core `startError` (`core/fleet-checks.ts`), from the field
  `withoutShips` of the rules of the Auspex-Erkundung
  (`features/missions/spy/rules.ts`), and the server words it „Keine
  Spähschädel auf dem Planeten.“; the Sternenkarte keeps its toast
  (`gspy`, `client/features/galaxy.ts`). The visible text stays; only the
  server's message changes, for a request the interface never sends (an
  Auspex-Erkundung with no probes selected).
* **F19** (message, found in the fleet pull request of #214) A Vermessung
  from the Sternenkarte without probes goes through the same button
  (`gspy`, `data-m="survey"`): the browser says „Keine Spähschädel auf dem
  Planeten.“, the server said „Keine Schiffe ausgewählt.“ **[V]**, follows
  the owner's decision on F12 of 2026-11-21 (through the coordinator,
  2026-11-21): unified the same way, the rules of the Vermessung
  (`features/missions/survey/rules.ts`) set `withoutShips: 'noProbes'`, so
  both say „Keine Spähschädel auf dem Planeten.“; only the server's message
  for a request the interface never sends changes.
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
  **[E]** Unified by the admin pull request of #214 (O18 (c), owner
  2026-11-15): one check, `endzeitError` in `core/endzeit.ts`, for the
  server and the dialog, which sends nothing with a wrong time and shows
  the server's text; the server's `ENDZEIT_ERROR` and the browser's
  `ENDZEIT_NOTE` (`client/logic/endzeit.ts`) hold the same texts, kept
  equal by `src/test/endzeit-texts.test.ts`. **[V]** Taken as recommended:
  „done“ is the text of the box, „In dieser Runde wurde die Endzeit schon
  eingeläutet.“, the one the admin sees every time; the server's word
  order came only with a second trigger from an old page or the API, and
  the Endzeit is not yet released (`changes/endzeit.md`), so no player saw
  either in a release.
* **F16** (message and rule) Guild profile: `views/guilds.ts:35-38` checks
  the lengths before trimming with `minlength` and `maxlength`, so the
  browser shows its own message [U: in the language of the browser, not
  checked], and allows any characters in the tag; the server
  (`guilds.ts:25-33`) trims, upper-cases the tag, allows only letters and
  digits, and answers in German.
* **F17** (rule) Rank names: `views/guilds.ts:219` and `:245` carry
  `minlength`, but the inputs sit in no form and `main.ts` calls no
  `checkValidity`, so only `maxlength` holds; the server refuses with „Der
  Rangname braucht 2 bis 24 Zeichen.“ (`guild-ranks.ts:110`; 67 until #277).

Checks only the server makes, besides those of „What counts“: the 20 orders
of the shipyard (`actions.ts:52` and `:256-257`; the browser leaves „Bauen“
enabled, `logic/catalog-list.ts:451`), `sendError` (the browser only hints
at a missing planet or Trümmerfeld), the universe settings, the tag and name
taken, and every rule of `claimDailyReward` beyond the state.

Notes, no disagreement:

* Numbers written into messages beside their constant in `src/core`:
  „2 bis 24“ (`guild-ranks.ts:110`, `MIN_RANK_NAME`, `MAX_RANK_NAME`),
  „25“ (`guild-ranks.ts:131`, `MAX_GUILD_RANKS`), „1 bis 4.320“
  (`endzeit.ts:55`, `GIFT_MINUTES`).
* `actions.ts:253` „Diesen Schutzdom gibt es nur einmal pro Planet.“ is the
  message of every unit with the component `limit`; only the two shield
  domes have one (`src/features/ssd`, `src/features/lsd`).
* `validateUniverse` returned German messages with the range of each
  setting, not codes; since the admin pull request of #214 the core check
  `universeErrors` returns codes and the server words them, unchanged.

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
* **[E]** Guild built (2026-11-21, #214): `src/core/guild-checks.ts` with
  one function per action (`createGuildError`, `updateGuildError`,
  `applyError`, `reviewError`, `leaveError`, `manageMemberError`,
  `createRankError`, `renameRankError`, `rightsError`, `moveRankError`,
  `deleteRankError`, `defaultRankError`, `assignRankError`,
  `dissolveError`) and `sendChatError`, `deleteChatError`, `seeChatError`
  in `core/guild-chat.ts`. Each returns the code of its first refusal in the
  order of the server, or null; finding the actor (`actor()`) and reading
  the store stay on the server, which words the codes from tables with the
  messages unchanged (`GUILD_ERROR`, `PROFILE_ERROR`, `SEND_ERROR`). The
  guild page (`client/logic/guilds.ts`) asks the same checks for its member
  and rank controls and offers exactly what it did. F16 and F17 stay. The
  server's words and their order are pinned by
  `src/server/game/guild-order.test.ts`, written before the move.
* **[V]** The checks of „What counts“ stay on the server; the table above
  names why.
* **[E]** Economy built (2026-11-16): `src/core/economy-checks.ts` with
  `buildErrors`, `researchErrors`, `orderErrors` and `isProducer`, and the
  predicates `hasLab` (`core/lab.ts`) and `hasYard` (`core/yard.ts`). Each
  of the three returns every code that applies, in the order of the
  server; the server refuses with the message of the first. Build and
  research have one order on both sides (F8, F9). The order of an `order`
  still differs and stays (no finding of O18): the server answers the lock
  of the shipyard before the requirements, the row of the browser shows
  „Das Wissen ist noch verschlossen“ before it disables „Bauen“ for the
  lock (the page names the lock above the list).
* **[U]** Found while building the economy pull request, not in the audit:
  the list of requirements (`needState` in `src/core/requirements.ts`,
  #64) offers „Jetzt bauen“ and „Jetzt forschen“ and combines the same
  predicates in a third order (place, requirements, fields, price and
  energy, then the waits) with its own short reasons. It is already pure
  in `src/core`, but does not call `buildErrors` or `researchErrors`; left
  as it is, so its texts and order do not change.
* **[E]** F18 (owner, 2026-11-16, in #214): `needState` calls
  `buildErrors` and `researchErrors` and keeps its own texts and order
  through its own code tables, with no visible change. **[E]** Built
  (2026-11-21): it takes the codes `place`, `locked`, `full`, then `cost`
  and `noEnergy` together, then the waits in the order of the codes
  (`BUILD_WAITS`, `RESEARCH_WAITS`), and leaves out the codes it never
  showed (`off`, `maxLevel`, `noLab`). Both checks take the level they
  start from as an optional `have`, as the list costs the next level of its
  own entry. `src/test/needs-reference.test.ts`, written before, compares
  it with the old code on 3000 generated places.
* **[E]** Player, rewards and fleet built (2026-11-21, #214):
  `planetNameError` (`core/planet-name.ts`) for `rename`; `claimError`,
  `dailyError`, `achievementOf`, `reached` and `achievementStatus`
  (`core/reward-checks.ts`) for the rewards, the last shared with the page
  „Achievements“; `startError`, `holdTimeError`, `stayError`,
  `cargoError`, `recallable` and `recallError` (`core/fleet-checks.ts`) for
  `send` and `recall`. Each returns the code of its first refusal in the
  order of the server, or null; the server gathers the values and words the
  codes with the messages unchanged, but F12. The SQL guards of the rewards
  stay („What counts“). The browser of the fleet keeps its hints; F11, F13
  and F14 stay. Pinned before the move by `src/server/game/rename.test.ts`,
  `rewards-order.test.ts` and `fleet-order.test.ts`.
