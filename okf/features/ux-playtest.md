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
* **[E]** No reloads (owner, 2026-11-23). Lesson: a note can still be
  saved a few seconds after „Weiter“; read a pick again before acting on it.
  Bug found by the owner (2026-11-23): two writes of the same pick could
  run at once, and a slow early write overwrote „Weiter“ (half note, `done`
  lost) while the page went on. Fixed in version 8 (owner chose an
  immediate reload): one write at a time per pick, each sends the newest
  state, „Weiter“ waits for all of them; a warning shows when leaving with
  unsaved text. All picks checked afterwards: every one has `done: true`;
  the empty answer of s6 was left empty on purpose (owner). The mechanism: the page is a player for a
  queue in its store and is not republished any more (version 7 is the
  last). Steps are documents `queue/<round>-<id>` (`seq` orders them;
  `kind` `sit` or `quest`; `variants.a|b|c` with `img`, `desc`, `emph`;
  `order`, `ask`, `station`, `roundTitle`); Claude appends with the
  Artifact data tool, new pictures go to the artifact's asset store
  (`/_blob/<id>`), and `status/claude` (`text`, `updated`) tells the owner
  what comes next. The top of the page lists the queue (count of prepared,
  done and open steps, each with its short title `short`) instead of the
  game loop (owner, 2026-11-23; version 9). A copy of the queue is in
  `docs/design/interface-modern/playtest/queue/`. The page subscribes to both and draws the open step
  again only when it changes, so typing is never disturbed.
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
| 1 | 1–4 | s1m galaxy map · s1s own system · s2m content of the Lage sheet · s3 building on fields · s4 info page · s1n names on the map, one by one | done 2026-11-23 15:40 |
| 1b | race skins | brut · ewige · r1b-quest (Brut sentence, friends colour, who is an enemy): the galaxy map with the Lage sheet, three versions each, animated (GIF); Brut a membran, b chitin, c schwarm; Ewige a monolith, b uhrwerk, c gitter | done 2026-11-23 15:46 |
| 2 | 5–7 | s5 research · s6 defense on Nox · s7 espionage · questions | done 2026-11-23 15:58 |
| 3 | 8–10 | planned | open |
| 4 | 11–13 | planned | open |
| d1 | desktop: galaxy + Lage in three layouts (a side panel, b sheet as on the phone, c windows; order c·a·b) | done 2026-11-23 16:04 |
| 3 | 7–9 | s8 espionage + report (b·c·a) · s9 send the fleet (a·c·b) · s10 battle + report (c·a·b) | done 2026-11-23 16:12 |
| d2 | desktop: windows, drag a world onto a target (a target window, b two system windows, c choice in the sheet; order b·c·a) | done 2026-11-23 16:16 |
| 4 | 10–11 | s11 new colony (c·a·b) · s12 guild + chat (a·b·c) · s13 Herold in the game (b·c·a) · s14 Börse (c·a·b) | done 2026-11-23 16:23 |
| 5 | 12, 9 | s15 away and back (b·a·c) · s16 ground combat #155 (a·c·b) | done 2026-11-23 16:29 |
| 6 | repeats | s2r the one Lage line (b·c·a) · sc the colour language (c·a·b) · sg several galaxies (a·c·b) · brut2 (c·a·b) · ewige2 (b·c·a) | running |
| 7 | tabs not tested yet | s17 Welten (b·c·a) · s18 Berichte (c·a·b) · s19 Menü (a·b·c) | done 2026-11-23 16:45 |
| 6b | races, third time | brut3 organic borders (b·c·a) · ewige3 technical frames (c·a·b), map unchanged | done 2026-11-23 17:56 |
| 6c | Brut again | brut4 more goo (c·a·b) · brut5 lit relief, prerendered (b·c·a) | done 2026-11-23 18:17 |
| d4–d7 | desktop | d4 research tree (b·c·a) · d5 fleet with presets (c·a·b) · d6 Herold + Börse (a·b·c) · d7 reports (b·c·a) | done 2026-11-23 18:20 |
| 6d | Brut after research | brut6 calm colour, real slime (c·a·b) | done 2026-11-23 18:25 |
| 6e | Brut with bones | brut7 ribs, spine, spurs on brut6 c (b·c·a) | done 2026-11-23 18:38 |
| 6f | Ewige and Imperium prerendered | ewige8 bronze (a·c·b) · imperium8 today / gold / ornaments (b·c·a) | done 2026-11-23 18:43 |
| d8–d10 | desktop | d8 Welten (c·a·b) · d9 Menü (b·c·a) · d10 Gilde (a·c·b); the old chat bubble at the bottom right is gone (s12) | done 2026-11-23 18:52 |
| d3 | desktop: building on fields + info page (a three columns, b windows, c as on the phone; order c·a·b) | done 2026-11-23 16:35 |
| 5 | more desktop views (building, info page) | planned | open |

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
| s1n names on the map | variant 1 = c, names on tap | note: „durch farbe kann man hier sicher gut erklären, was man wo sieht. wichtig ist, dass die farbliche sprache dann aber einheitlich ist und man schnell zwischen fremden spielern, feinden, gilden, freunde und man selbst unterscheiden kann“ | **[E]** names appear on tap. **[E]** one colour language everywhere that tells apart self, friends, guild, enemies and other players. Friends have no colour yet; r1b-quest asks how they look and who counts as an enemy. |
| r1 questions | – | device: Desktop · visit: 2 bis 10 Minuten · first look: „was ist passiert, was könnte ich jetzt machen und dann abwägen“ · focus: schnell erfassen, was los ist; wenige Klicks; Atmosphäre und Optik; mit dem Daumen bedienbar · missing: „gerne auch desktop ansichten mich abfragen, bisher nur handy.“ | **[E]** the owner plays mostly on the desktop, in visits of 2–10 minutes. **[E]** the first look answers: what happened, what can I do now. **[V]** desktop views move forward: right after round 2, the round-1 winners on the desktop. |
| r1b Brut | variant 1 = b, chitin | answer (should terms change per race): „ja“ · note: „mit wabern meinte ich so ein organisches ding wie bei starcraft 2. dass das interface dann eben organische“ (completed a few seconds later: „… organische elemente hat und sich so ein bisschen bewegt. gerne auch ein wenig eklig“) | **[E]** terms change per race. **[E]** Brut leads with chitin; the wobbling means organic elements that move a little, „gerne auch ein wenig eklig“, in the spirit of StarCraft II's Zerg (inspiration only, own design). The note was finished after „Weiter“ (saved late), so r1b-quest asked again. |
| r1b Ewige | variant 3 = b, clockwork | answer (how much motion): „eher ruhig“ · note: „gerne mehr "mechanik" und future knicke 65 grad.“ | **[E]** Ewige lead with clockwork: calm motion, more visible mechanics, futuristic bends at 65°. |
| r1b questions | – | Brut: „elemente hat. wie bei starcraft 2 bei den zergs, auch ein wenig eklige bewegung.“ · friends: „eigene Farbe für Freunde“ · enemy: all three (guilds at war with mine, who attacked me lately, whom I mark myself) | **[E]** friends get their own colour; the colour language has five kinds: self, friends, guild, enemies, others. **[E]** „enemy“ = guilds at war with mine, players who attacked me lately, players I mark myself. |
| s5 research (goal Plasma-Lehre) | variant 3 = b, tree of prerequisites with the path to the goal highlighted | note: „damit wird viel deutlicher wie dinge zusammenhängen. gerne auch mal als vollständigen forschungsbaum darstellen. den man von rechts nach links scorllen kann.“ · answer (queue of several researches): „nur mit einer speziellen forschung. die dann eben eine warteschleife freischaltet. bei verschiedenen stufen wird beim bau, forschung und flottenbewegung möglich.“ | **[E]** research is shown as a tree of prerequisites with the path to the goal highlighted; also as a full research tree that scrolls sideways. **[E]** game rule: queues only through a special research that unlocks a queue; its levels unlock queues for building, research and fleet movements (names, levels and order open; belongs into a feature file). |
| s6 defense on Nox before the attack | variant 1 = b, one installation large, drag the amount, resource bars and a timeline up to the attack | note: „gerne darf man auch bei einem angriff im unteren schieber eine entsprechende meldung angezeigt bekommen. eine art mission control“ · answer: left empty on purpose | **[E]** defense: one installation large with an amount slider, resource bars and a timeline to the attack. **[E]** during an attack the Lage sheet shows an alert, „a kind of mission control“. |
| s7 espionage | variant 1 = a, from the system view: tap Varn, the sheet shows the age of the report and sends spy skulls | note: „gerne auch den angriffs knopf darunter packen zum spionieren“ · answer (spy on several targets at once?): „wäre in ordnung. nimmt einem klicks ab und daher keine automatisierung.“ | **[E]** espionage starts from the system view in the sheet; the attack button sits right under the spy button. **[E]** spying on several targets at once is fine: it saves clicks and is not automation (#181). |
| r2 questions | – | pace: „genau richtig“ · missing: „berichte sollten auch schnell einsehbar sien. vllt kann man das mit der spionage zusammenbringen. also das spionage auch mit dem bericht zusammen gedacht wird.“ | **[E]** reports must be quick to reach; espionage and its report are designed together. Next situation: spy and report in one place. |
| d1 desktop: galaxy + Lage | variant 3 = b, the Lage sheet at the bottom as on the phone, the areas on top | note: „ich mag von variante 1 das window, was das system darstellt. kriegne wir das hin, das man mit so einem mini window auch dinge auf einem planeten ausführen kann? vllt sogar sowas interaktiven, dass man von einem planeten als origin aus dem system window auf ein system drag and drop ziehen kann und dann geht ein zweites window auf, wo man dann das "target" auswählt und dann entscheidet, was man da machen möchte als aktion? vllt auch mehrere system window erlauben, dann geht das auch direkt. jedenfalls finde ich das gut, auf einem desktop kann man mehrere dinge gleichzeitig machen.“ · answer (hover or click): „das problem ohne klick ist immer, dass es nur schwer herausfindbar ist, ob der user nun das haben möchte oder nur drüber gefahren ist. lass es gerne mit klick.“ | **[E]** desktop: the Lage stays a sheet at the bottom; the areas move to the top. **[E]** desktop adds windows: system windows, several at once, with actions on their worlds; dragging a world from a system window onto a system opens a second window to pick the target and the action. **[E]** names and infos on click, not on hover. Next: d2 tests the drag. |
| s8 espionage + report | variant 3 = a, the report opens in the sheet of the world | note: „damit ist der schieber wertvoller und kontext sensitiv. in übersichten siehst du allgemeine infos, bei klick auf dingen kiregst du deren spezialisierte infos und aktionen. sehr schön.“ · answer (where to find an old report): „ich finde, alle 3 sachen sehr sinnvoll. je nachem welche ursprungsfrage man hatte. wenn ich mich frage "was als nächstes" dann würde ich durch die zeitleiste gehen "was weiß ich denn", dann über eine liste und wennich mir denke "der ist schön nah dran" dann über die welt ansicht.“ | **[E]** the sheet is context-sensitive: an overview shows general information, a tap on a thing shows its own information and actions. **[E]** a report opens in the sheet of its world and is reachable three ways: the timeline („what next“), a list of reports („what do I know“), the world („he is close“). |
| s9 send the fleet | variant 2 = c, presets | note: „Variante 3 finde ich für eine schnelle aktion auch sehr gut. gerne hätte ich variante 2 den schieber, wenn ich bei einem planeten drauf klicke, variante 3 ist aber auch möglich als eingabe für einen angriff und dann kriege ich den einschieber für variante 2. und ich brauche eine auswahl wie in variante 1. das sollte auch möglich bleiben bei variante 2.“ · answer: „vorlagen pro spieler“ | **[E]** a tap on a world opens the sheet with presets (c); dragging a route on the map (b) is a second way to start an attack and opens the same sheet; the ship-by-ship selection (a) stays possible in it. **[E]** presets are saved per player. |
| s10 battle + report | variant 2 = a, the report as a table in the sheet | note: „variante 1 solle aber auch drin sein in der zeitliste. und man sollte mit einem klick direkt zum bericht kommen statt die aktioenn zu sehen. die wiederholung finde ich spannend, sollte aber via herold abrufbar sein als "kriegsbericht". siehe die godot issue idee als animation.“ · answer (own plain replay?): „jede schlacht sollte eine herold anzeige haben, aber eben nur für dich als angreifer / verteidiger ansehbar sein. der öffentliche herold zeigt dann nur öffentliche berichte, die er recherchiert hat oder einer der spieler auf veröffentlichung drückte (ala Durchgestochen /. geleakt). damit gibt es eine weitere möglichkeit das der herold an infos kommt.“ | **[E]** the battle report is a table in the sheet; the battle also stands in the timeline, and one click there opens the report (no actions in the entry). **[E]** the replay comes from the Herold as „Kriegsbericht“ (Godot animation, #382): every battle has one, visible only to attacker and defender. **[E]** the public Herold shows only reports it researched or that a player published („durchgestochen“); leaking is another source of the Herold. Belongs into #382. |
| d2 desktop: drag a world onto a target | variant 3 = a, drop on a system of the map, a target window opens | note: „variante 1 ist auch sehr gut, wenn man zwei system window auf hat. wenn nur eins offen, dann ist variante 3 am besten geeignet.“ · answer (restore windows at login?): „nein. die galaxie übersicht ist der startpunkt.“ | **[E]** desktop: drag a world onto a system of the map → a target window opens to pick world and action; with two system windows open, drop straight onto the world in the other window (b). **[E]** windows are not restored at login; the galaxy overview is the start. |
| s11 new colony | variant 2 = a, free positions as dashed rings in the own system | note: „es sollte eine möglichkeit geben, noch andere sy steme anzugeben. aber wenn man wählt, dan über dieselbe karte wie die übersicht bisher.“ · answer (what decides where): „je nach bedarf. da ja auch die position im system wichtig ist, spielt das auch noch rein zu deiner auflistung“ | **[E]** a colony is chosen on the free rings of a system view; other systems are reached over the same galaxy map as everywhere. **[E]** the position in the system matters for the choice, so it belongs into any list of free places. |
| s12 guild + chat | variant 2 = b, a tab „Funk“ in the Lage sheet | note: „finde ich gut, weils schnell zugreifbar ist und damit den schieber wieder etwas mehr in den fokus rückt.“ · answer (events in the guild chat?): „nur nachrichten. für events könnte man die zeitleiste nutzen mit einem gilden filter.“ | **[E]** the chat is a tab in the Lage sheet (replaces the chat at the bottom right of study D). **[E]** the chat holds only messages; events of members go into the timeline, with a guild filter. |
| s13 Herold in the game | variant 2 = c, its own newspaper page in the game | note: „finde aber auch variante 3 sehr sinnvoll, um da den herold im schieber schnell verfügbar zu machen. das der neueste kriegsbericht dort direkt zum durchstehcen agneboten wird, finde ich spannend. erspart wieder klciks.“ · answer (Herold news about you in your timeline?): „auf jedenfall. gute idee.“ | **[E]** the Herold has its own newspaper page in the game, and a tab „Herold“ in the Lage sheet that offers the newest Kriegsbericht with „Durchstechen“. **[E]** Herold news about the player also appear in the player's timeline. Belongs into #382. |
| s14 Börse | variant 3 = b, „Tauschen“ in the sheet | note: „variante 1 finde ich für die übersicht hervorragend geeignet. variante 3 ist dann, wenn man auf einen planeten klickt. durch den filter weiß der user ja dann, was es kostet, was er suchte.“ · answer (count the delivery time in the best rate?): „das ist eine option, die die oberfläche anbieten sollte.“ | **[E]** Börse: a map layer shows the offers at the traders' systems for the overview (c); a tap on a world opens „Tauschen“ in the sheet (b). **[E]** whether the delivery time counts for the best rate is an option the player sets. Belongs into #386. |
| s15 away and back | variant 2 = a, „Willkommen zurück“ in the sheet: counts since the last visit and „Jetzt tun“ | note: „ich finde alle 3 varianten sehr cool und wichtig. gerne ist variante 2 die anzeige. und dort steht dann ein button für einen view, der diese in der galaxiekarte so anzeigt. was mir aber auffällt: die galaxiekarte respektiert ja nicht, das es auch mehrere galaxien geben kann. das müssten wir auch noch durchdenken“ · answer (which pushes): „push nachrichten sind ja einstellbar. lass den user das entscheiden. aber die nachrichten sollten dich in den entpsechenden view holen.“ | **[E]** after an absence the sheet shows „Willkommen zurück“ (counts, „Jetzt tun“) with a button that shows those places on the galaxy map (c). **[E]** pushes stay the player's choice (#192) and open the matching view. **[E]** open point: the galaxy map must handle several galaxies (the admin sets the number); next situation. |
| s16 ground combat (#155) | variant 3 = b, the siege overview first, the board behind a button | note: „für die detaildarstellung würde ich dann viarante 1 bevorzugen.“ · answer (plan on the phone?): „ja du musst auch am handy planen können“ | **[E]** a siege opens with its overview (phase, supply, damage, troops); the board itself fills the screen with the planner in the sheet (a). **[E]** moves can be planned on the phone. Belongs into #155. |
| s2r the one Lage line | variant 2 = c, the most urgent item with the time left | note: „wenn ich dann den scieber hochziehe, sehe ich wieder alle ereignisse. wenn ich genau diese nachricht reagieren möchte, klicke ich auf den eintrag. da braucht kein button daneben. aber eine anzeige, dass er anklickbar ist, wäre nicht schlecht. also entweder button oder eine andere form des nudgings“ · answer (switch when nothing is urgent?): „wenn es nicht dringendes gibt, dann gerne langsam durchrotieren.“ | **[E]** pulled down, the Lage line shows the most urgent item with the time left; a tap on it opens it; no button beside it, but a hint that it can be tapped. **[E]** with nothing urgent the line rotates slowly through the events. |
| sc the colour language | variant 1 = c, colours and shapes | note: „farben sollten in der option einstellbar sein, wenn jemand farbenblind ist oder rot-grün schwäche. da sollten wir einfach merhere farbsets anbieten. aber das sie eigene symbole kriegen, ist auch richtig.“ · answer: „immer dabei sein, lässt sich auch i nder option einstellen, dass dann eben nur kreise verwendet werden.“ | **[E]** each group has its own colour and its own shape (self circle in blue, friends diamond, guild square, enemies triangle, others circle); shapes are on by default, an option uses circles only. **[E]** the options offer several colour sets (colour blindness, red-green weakness). |
| d3 desktop: building + info page | variant 3 = b, the surface as a window over the map, the info page as a second window | note: „finde ich sehr gut, wenn wir mit windows arbeiten. das erspart klicks, wenn man eigentlichv erschiedene übersichten haben will.“ · answer (tabs side by side on the desktop?): „da ich windows möchte, könnte der platz dann doch wieder klein ausfallen“ | **[E]** desktop: the planet surface opens as a window over the map, the info page of a building as a second window; the info page keeps its tabs. Windows are the desktop pattern. |
| sg several galaxies | variant 3 = b, the universe as a zoom level above the galaxies | note: „ich finde alle 3 varianten sinnvoll. in den optionen könnte man dann noch einstellen, ob man dann nur wischen möchte oder das wischen abstellen will. die auswahl könnte man damit dann verstekcne, wenn "nur wischen" gewhlt ist. aber die galaxie übersicht finde ich wichtig.“ · answer (how many galaxies): „2-3. aber das sollte keine rolle spielen.“ | **[E]** the universe is a zoom level above the galaxies (universe › galaxy › system). **[E]** the switcher and swiping between galaxies come too; an option: „only swipe“ (hides the switcher) or swiping off. **[E]** expect 2–3 galaxies, but the design must not depend on the number. |
| brut2 Brut again | variant 2 = a, veins | note: „nein, das geht alles in die falsche richtung. adern sind schonmal gut, aber ich meinte eigentlich sowas wie ränder etc. das das eben so ein paar organische elemente hat. das wird schwierig mit reinem css, höchstens mit irgendwelchen bildern in den borders.“ · answer (may the motion touch the controls?): „nein. nur hitnergrund und ränder“ | **[E]** the race lives in the UI elements: borders and frames get organic elements (images in the borders); veins are good. **[E]** motion only in background and borders, never in the controls. The overlays of round 1b and brut2 are out. Next: brut3 with organic frames. |
| ewige2 Ewige again | variant 1 = b, gears | note: „auch hier. ganz schlimm. nur die ui elemente sollen sich ändern uund diese technischen aspekte aufgreifen. wie bei starcraft 2 die protos. da verändert sich die rahmen.“ · answer (terms technical or solemn-old?): „feierlich-alt“ | **[E]** only the UI elements change and carry the technical side, the frames above all (in the spirit of StarCraft II's Protoss, inspiration only, own shapes); no effects over the map. **[E]** the Ewige's terms are solemn and old. Next: ewige3 with technical frames. |
| s17 tab Welten | variant 3 = a, cards per world with picture, what runs, progress, main hint | note: „ein wechsel zwischen den welten ist hiermit sehr leicht möglich und man bekommt einen eindruuck zum planeten durch das bild. das wischen zwischen den planeten wäre noch hilfreich, wenn man in einem view ist und dann zu einem anderen planeten wechseln möchte. aber auch hier wie die galaxienauswahl: man sollte wählen können ob man eine asuwal hat oder mit wischen oder nur wischen.“ | **[E]** Welten: one card per world with its picture. **[E]** inside a world's view, swiping goes to the next world; as for galaxies, an option: picker, picker and swipe, or swipe only. |
| s18 tab Berichte | variant 2 = a, a list by time with filters (Kampf, Auspex, Flotte, Lieferung) | answer (delete or pin?): „grenze je spieler, wenn sie erreicht wird, verschwinden sie automatisch.“ | **[E]** Berichte: a list by time with filters; a tap opens the report in its world's sheet. **[E]** reports keep today's limit per player; past it the oldest disappear on their own. |
| s19 tab Menü | variant 1 = a, the menu as a sheet from below | note: „füllt den schieber wieder, ist ein wiederkehrendes element. und das runter ziehen schließt das menü, genauso wie der klick auf die karte.“ · answer (Admin in the same menu?): „darf da ruhig mit drin stehen.“ | **[E]** the menu (Lexikon, Soziales, Optionen, Admin) opens as the sheet; pulling it down or tapping the map closes it. **[E]** „Admin“ stands in the same menu for admins. |
| brut3 Brut, only the borders | variant 3 = a, chitin thorns on the edges of bar, sheet and tabs, veins along the edge | note: „dürfte durch organisch sein. also so richtig mit erkennbaren adern von zergähnlichen wesen. ruhig ein wenig mehr schmodder.“ · answer (buttons and pills too?): „nur ränder und große flächen“ | **[E]** Brut: chitin thorns on the edges of the large surfaces (top bar, sheet, tab bar) with veins; it may be more organic: clearly visible veins of creature-like beings, „ein wenig mehr Schmodder“ (goo). **[E]** only borders and large surfaces, not buttons or pills. |
| ewige3 Ewige, only the frames | variant 2 = a, bronze double frames with 65° corners and a glowing gem | answer (terms Sternkarte, Chronik, Zeitlauf, Kreis?): „passt so“ | **[E]** Ewige: bronze double frames with 65° corners and a glowing gem in the middle of the edges. **[E]** terms: Sternkarte, Welten, Flotten, Chronik, Zeitlauf (for Lage), Kreis (for galaxy). |
| brut4 Brut, more goo | variant 1 = c, a fleshy band with veins under the thorns | note: „mach die ganze sache tetwas plastischer und realistischer. also auch ruhig 3d. es muss auf nichts reagieren, also darf es prerendered sein. lass es echt wirken.“ · answer (is this the direction?): „ja, siehe meinen beitrag oben“ | **[E]** Brut direction: a fleshy band with veins; more plastic and realistic, 3D allowed; it reacts to nothing, so prerendered images are fine. Next: brut5 as lit relief (prerendered). |
| d4 desktop: research tree | variant 1 = b, the tree as a window over the map, the goal as a second window | note: „eine forschung als voraussetzung sollte mehrfach vorkommen, wenn es in verschiedenen ausbaustufen benötigt wird. sonst hat man sehr verwirrende überschneidungen.“ · answer: „derb aum soll alle forschungen zeigen und beim ziel nur den weg hervorheben“ | **[E]** desktop research: the tree is a window, the goal a second window. **[E]** the tree shows all researches; with a goal only its path is highlighted. **[E]** a prerequisite needed at different levels appears once per level, so lines do not cross. |
| d5 desktop: fleet with presets | variant 2 = a, all in the target window: action, preset, ships, send | note: „auf dem desktop sollte das breite blatt durch ziehen immer dieselben informationen anzeigen. auf dem handy ändert sich das, denn dort haben wir ja die windows dinge nicht.“ · answer (several fleet windows?): „ja. die fenster bedingen sich ja gegenseitig nicht, sebst wenn es aus einem anderen fenster heraus geöffnet wurde. so kann der spieler verschiede informationen nebeneinander legen. am besten lassen sich windows auch "minimieren" bzw. pinnen, damit sie nicht geschlossen werden können bzw. sich wieder schneller aufrufen lassen. pin ist wie ein favourite, das heißt dessen fenster wird auf dem server gespeichert und schnell wieder aufrufen. nach einem login, sind alle gepinnten fenster minimiert und damit die sicht auf die galaxie offen.“ | **[E]** desktop fleet: everything in the target window. **[E]** desktop: the wide sheet always shows the same information when pulled up; only on the phone it changes with the context. **[E]** windows are independent of each other, even when one opened another; several fleet windows at once. **[E]** windows can be minimized and pinned; a pinned window is a favourite stored on the server; after a login all pinned windows are minimized, so the galaxy is in view (refines d2: unpinned windows are not restored). |
| d6 desktop: Herold + Börse | variant 3 = c, both in the pulled-up sheet | note: „der herold sollte im lage-blatt sein. die börse kriegt ein eigenes icon rechts oben in der galaxie karte, womit dann die entsprechenden angebote angezegit werden. und oben im menü auch, wo es dann als liste angeeigt wird.“ · answer (Kriegsbericht in a window or full screen?): „fenster mit vollbild option wie bei youtube“ | **[E]** desktop: the Herold sits in the Lage sheet. **[E]** the Börse gets its own icon at the top right of the galaxy map that shows the offers on the map, and an entry in the top menu that shows them as a list. **[E]** the Kriegsbericht plays in a window with a full-screen option. |
| brut5 Brut, lit relief | variant 1 = b, chitin | note: „die farbe ist aber eine katastrophe und zieht zu viel aufmerksamkeit. das ist nich gut. schaus dir nochmal. genauer an und probiere aus. bei starcraft 2 ist es bei den zergs gut gelöst. recherchiere bitte!“ · answer (drops and strands?): „gerne schleimtropfen, aber eher zäher und langsamer, sowie schleimiger und nicht so html style. das sollte auch sehr viel echter wirken. genauso wie schleimfäden sollten echt wirken.“ | **[E]** Brut: chitin in lit relief is the direction. **[E]** the colour must be far calmer and must not draw attention; research how StarCraft II's Zerg interface solves it (inspiration only). **[E]** slime drops yes, but thicker, slower, slimier and real, not „HTML style“; slime strands real as well. Next: brut6 after research. |
| d7 desktop: reports | variant 1 = b, the list as a tab of the Lage sheet, the report as a window | note: „bei mehr einträge als höhe des lage-blatts, dann kann man das scrollen und weiter nach oben ziehen. das sind aber feste höhen, zweistufigkeit: so minimal wie bisher und ganz nach oben. und wichtig: das lage-blatt sollte nur eine angemessene breite haben, also wenns so ausreicht so in der mitte zu sitzen und dann 400px breite, dann ist gut. ansonsten größer. aber es darf nicht in der breite hin und herspringen. sondern alle reiter dieselbe breite.“ · answer (several reports open at once?): „ja“ | **[E]** desktop reports: the list is a tab „Berichte“ of the Lage sheet; a report opens as a window; several report windows at once. **[E]** the Lage sheet has two fixed heights (the one line, and fully up) and scrolls inside. **[E]** on the desktop the sheet sits in the middle with an appropriate fixed width (about 400 px if that is enough, wider if needed); every tab has the same width, the sheet never jumps in width. |
| d8 desktop: Welten | variant 3 = b, a slim strip on the left with all worlds | note: „da ja die planeten verschiedene ressourcen haben, müssten die informationen sichtbar sein. gerne nutzen wir die schmale leiste dafür. da die galaxiekarte ja das hauptansicht ist und man dort dann auch die planeten anklicken kann, fürs bauen. die linke liste ist dann eine schnelle form dahin zu kommen zur ansicht fürs bauen etc. die links oben im menü sind dann eben übersichten und schnelle ansichten, um dinge zu erkennen. aber "machen" wie flottenverlegung etc. geht über die galaxiekarte.“ · answer (click opens the surface or jumps to the map?): „ja, genau so. im fenster ist dann noch ein button mit "direkt zur welt" um direkt auf die karte zu springen. gerne kann man mit dem scrollrad zwischen den stufen zoomen von der universums übersicht mit allen galaxien zu einer einzelnen zu einem system.“ | **[E]** desktop Welten: a slim strip on the left lists all worlds with their resources and state; a click opens the world's surface as a window (to build), with a button „Direkt zur Welt“ that jumps there on the map. **[E]** the galaxy map is the main view; acting (fleets, moving) goes through the map; the links at the top are overviews and quick views. **[E]** the scroll wheel zooms through the levels universe › galaxy › system. |
| d9 desktop: menu | variant 3 = a, a drop-down under „Menü“ at the top | answer (Lexikon pinned beside the game?): „das lexikon sollte eine seitenleiste auf der rechten seite sein. dann ist das eine klare aufteilung: rechts wissen, links übersicht über die eigene welten. oben menü, unten informationen und kommunikation.“ | **[E]** desktop menu: a drop-down under „Menü“ at the top. **[E]** the Lexikon is a sidebar on the right. **[E]** the desktop layout: left the own worlds, right knowledge (Lexikon), top the menu, bottom information and communication (the Lage sheet), the map in the middle. |
| d10 desktop: guild | variant 2 = c, a map layer „Gilde“ shows the members at their systems, the chat in the sheet | answer (members always visible on the map?): „Die gildenmitgleider sind farblich immer hervorgehoben, aber die infos sind immer nur in ebene gilde“ | **[E]** desktop guild: guild members are always highlighted in their colour on the map; their details (status, what they do) show only in the map layer „Gilde“; the chat stays in the sheet („Funk“). |
| brut6 Brut, calm colour and real slime | variant 1 = c, calm chitin with viscous slime: drops neck and fall slowly, strands hang | note: „sehr gut. in den optionen lässt sich das durch "keine animationen" deaktivieren. aber genau sowas. und jetzt gerne noch so "echte" knochen style einbauen für mehr schmodderigkeit.“ · answer (colour calm enough?): „nein ist gut“ | **[E]** Brut: dark, muted purple-brown chitin in lit relief, thin borders, viscous slime (drops and strands) – „genau sowas“; the colour is right. **[E]** an option „keine Animationen“ switches the motion off. **[E]** next: add real-looking bones for more goo. |
| brut7 Brut with bones | variant 3 = a, ribs hanging from the top bar | answer (bones everywhere the same?): „Rippen oben und kleine Knochensporne unten klingt gut“ | **[E]** Brut bones: ribs hang from the top bar, small bone spurs sit on the sheet's edge below; with the calm chitin and the viscous slime of brut6. |
| ewige8 Ewige prerendered | variant 2 = c, dark bronze with engraved 65° notches | answer (should the gem change colour on events?): „ja, sehr gerne. geile idee.“ | **[E]** Ewige: dark bronze frames, lit relief, engraved 65° notches, a glowing gem. **[E]** the gem changes its colour on events (e.g. an attack). |
| imperium8 Imperium in the same frames | variant 2 = c, gold strips with ornaments | note: „gerne die zier noch goldeneer halten.“ · answer (light shimmer?): „still bleiben“ | **[E]** Imperium: plastic gold strips with ornaments (pointed arches at the corners and the middle of the sheet), the ornaments more golden. **[E]** the Imperium stays still, no motion. |

## Open work

* Owner chose (2026-11-23 18:00): Brut once more, more desktop rounds, the rules into the feature issues (#382, #386, #155, #158, #154); not yet the rewrite of #388.
* Rules handed to the feature issues as comments (2026-11-23): [#382](https://github.com/Heiss/nova-imperium/issues/382#issuecomment-7109729537), [#386](https://github.com/Heiss/nova-imperium/issues/386#issuecomment-7109730732), [#155](https://github.com/Heiss/nova-imperium/issues/155#issuecomment-7109731930), [#158](https://github.com/Heiss/nova-imperium/issues/158#issuecomment-7109733023), [#154](https://github.com/Heiss/nova-imperium/issues/154#issuecomment-7109734744). New idea issues (owner, 2026-11-23): queues through a special research (s5) [#391](https://github.com/Heiss/nova-imperium/issues/391); spying on several targets at once (s7) [#392](https://github.com/Heiss/nova-imperium/issues/392).
* Owner chose (2026-11-23 18:33): Ewige as prerendered images, the Imperium in the same frames, more desktop views (Welten, Menü, Gilde); not yet the rewrite of #388.
* Queue empty (2026-11-23 18:52); ask the owner how to go on.
* Mistake noted (2026-11-23): the desktop mockups d1–d7 still showed a chat bubble at the bottom right although s12 put the chat into the sheet; d8–d10 drop it; the rewrite must not carry it over.
* Research for brut6 (2026-11-23): [Screen Rant, StarCraft II developer interview](https://screenrant.com/starcraft-2-developer-interview-10th-anniversary/) (Heart of the Swarm UI in a purple tone, flatter than before; console skins of similar size so they do not cover the game); [PC Gamer, Sam Didier](https://pcgamer.com/starcraft-ii-art-of-the-swarm-interview-with-sam-didier) and [GameSpot](https://www.gamespot.com/articles/blizzard-talks-starcraft-ii-art-design/1100-6171176/) (bold colour belongs to the units). No detailed description of the Zerg console itself was found; used as principles only.
* After the race repeats: sum up and ask the owner whether more repeats are needed or #388 and the study get rewritten.
* The loop is covered once (s1–s16, d1–d2). Next: repeats with variants inside the winners, and desktop views of the new winners.
* Race follow-up: Brut chitin with organic, slightly disgusting motion; Ewige clockwork with 65° bends; per-race terms; a colour for friends.
* Build the desktop round of the round-1 winners and append it after round 2.
* Build round 2 from them (stations 5–7 and a repeat of the winners).
* At the end: rewrite #388 and the design study; carry the decisions [E]
  into the feature files they concern (#158, #155, #236).
