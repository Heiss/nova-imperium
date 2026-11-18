---
type: log-entry
date: 2026-11-18T23:10
kind: Code
issues: [95, 190, 175, 223]
---

Bundle 2 (the Mondbruch #95 and the Vermessung #190 on top of bundle 1): the two `src/server/game/fight.ts` of #175 and #95 are one module. It keeps the battle pipeline of #175 (`fight`, `recordBattle`, `battleReport`, `WON`, `rebuild`) for the Sturmangriff, the detected Auspex-Erkundung and the Mondbruch, and adds what Sturmangriff and Mondbruch share: `plunder` and `cutLoot` (one `fill`), `raid` (battle, loot, save, audit), `attackReports` and `flyHome`. The Vermessung got the mission order 80, because the Mondbruch has 70 (each order once). The later migration `20261117T1211-planet-survey` lists `moonbreak` in the CHECK of `fleets.mission` as well, so it does not take the Mondbruch away again. New tests pin that a Mondbruch at a player in vacation mode is refused first (`vacation` before the noob protection and `noWorldbreaker`), that the highscore follows a broken moon and lost Weltenbrecher, and that a Vermessung is refused during the own vacation mode. The upgrade test of migration 20 runs the later migrations before the game reads the players (the vacation column of #223).
