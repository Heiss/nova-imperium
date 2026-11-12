---
type: feature
title: Ionentechnik, Plasmatechnik, Gravitonforschung and IFN
description: The research added by issue #49, its values, the energy check of Gravitonforschung, the research network (IFN) with research on any planet, and what stays out.
---

# Ionentechnik, Plasmatechnik and Gravitonforschung

Issue #49, milestone `next release` with #46, #47 and #50 (owner, 2026-11-12).
Not in version 1; the classic values of the issue, confirmed by the owner as
they are (2026-11-12).

* **[E]** Scope: Ionentechnik, Plasmatechnik, Gravitonforschung and the
  Intergalaktisches Forschungsnetzwerk (IFN), classic (owner, 2026-11-12;
  replaces the first decision of the same day to leave IFN out).
* **[E]** IFN: 240,000 metal, 400,000 crystal, 160,000 deuterium at level 1,
  factor 2. Requires Forschungslabor 10, Computertechnik 8,
  Hyperraumtechnik 8. Introduced with v0.70a, before 1.0 (owiki.de).
* **[E]** Research may start on any own planet with a Forschungslabor, and its
  cost is paid on that planet. This replaces „Research uses the home planet“
  in [Colony ships](/features/colonization.md); rewards stay on the home
  planet. Still one research at a time per player (owner, 2026-11-12).
* **[E]** Each IFN level links one more own lab: the researching planet's lab
  plus the IFN level many highest other labs. A lab joins only if its own
  level meets the lab requirement of the research; the levels of all joined
  labs are added and count as one lab for the research time. Example: labs 10
  and 6 research Schildtechnik like lab 16, Hyperraumantrieb (needs lab 7)
  like lab 10 (owiki.de, owner, 2026-11-12).
* **[E]** The lab lock stays (`src/shared/lab.ts`): no lab is upgraded while
  research runs, and research does not start on a planet whose lab is being
  upgraded.
* **[U]** Whether a lab that is being upgraded on another planet joins the
  network is not on owiki.de. **[V]** It does not join.
* **[E]** Expeditionstechnik stays out of this issue. It comes with a new
  issue for expeditions, together with the expeditions themselves (owner,
  2026-11-12, #49 D3).
* **[E]** Ionentechnik: 1,000 metal, 300 crystal, 100 deuterium at level 1,
  factor 2. Requires Forschungslabor 4, Lasertechnik 5, Energietechnik 4.
  Prerequisite of the Ionengeschütz (#50) and of Plasmatechnik (owner,
  2026-11-12).
* **[E]** Plasmatechnik: 2,000 metal, 4,000 crystal, 1,000 deuterium at
  level 1, factor 2. Requires Forschungslabor 4, Energietechnik 8,
  Lasertechnik 10, Ionentechnik 5. Prerequisite of the Plasmawerfer (#50) and
  the Bomber (#57). No production bonus on mines (modern rule, not classic)
  (owner, 2026-11-12).
* **[E]** Gravitonforschung: no metal, crystal or deuterium; 300,000 energy
  at level 1, ×3 per level. Requires Forschungslabor 12. Research time one
  second (`MIN_TIME` in `src/shared/economy.ts`). Prerequisite of the
  Todesstern (#60) (owner, 2026-11-12).
* **[E]** Energy check, classic (#60 D2 = 1): the research starts only when
  the planet's energy production is at least 300,000 · 3^(level − 1). The
  energy is not consumed. The sources are the Solarsatellit (#46) and the
  Fusionskraftwerk (#47), both in the same milestone (owner, 2026-11-12).
* **[U]** The values are from the wiki (sources in #49); the owner took them
  over unchanged.
* **[V]** An energy requirement is a new kind of cost in `ResearchDef`, the
  research view and the research queue. Without enough energy the research
  can't start and a German message names the missing energy.
* **[V]** New art and German descriptions for the three entries, in the style
  of the existing ones; the owner checks the texts in the pull request.

# Code, interface and tests

* **[V]** Keys and abbreviations: `ion` (Io), `plasma` (Pl), `graviton` (Gr),
  `ifn` (IF) in `RES` (`src/shared/catalog.ts`); no other entry uses these
  abbreviations (test in `catalog.test.ts`).
* **[V]** German descriptions, for the owner to check in the pull request:
  Ionentechnik „Beschleunigte Ionen – Basis für Ionenwaffen.“, Plasmatechnik
  „Gebändigtes Plasma – Basis für Plasmawaffen.“, Gravitonforschung „Kostet
  keine Rohstoffe, braucht aber eine gewaltige Energieproduktion.“, IFN
  „Vernetzt pro Stufe ein weiteres Forschungslabor deiner Planeten.“
* **[V]** The energy requirement is the optional field `energy: { base, f }`
  of `ResearchDef` (Gravitonforschung: 300,000, factor 3). `energyNeed` and
  `energyShort` in `src/shared/research.ts` compare it with
  `prod().eProd` of the starting planet, rounded up. Server refusal: „Zu
  wenig Energie: Gravitonforschung braucht eine Energieproduktion von
  300.000, es fehlen …“. The research time is the minimum of one second
  because the resource cost is 0.
* **[V]** The research network is one pure function, `networkLab` in
  `src/shared/research.ts`, used by the action `research` and by the
  research view; `labSite` describes a planet for it (lab level, lab being
  upgraded). The state of the game carries `labs`, the lab of every own
  planet moved to the time of the request; it replaces `home` (the home
  planet when a colony is shown), which only the home planet rule of the
  requirements list needed.
* **[V]** Storage: the running research keeps the planet where it started
  (`rq.planet`, column `users.rq_planet`, migration 10). A cancel refunds
  that planet from any planet; research started before #49 has none and is
  refunded to the home planet. Upgrade test
  `src/server/db/upgrades/migration-10.test.ts`.
* **[V]** Research view („Forschung auf <Planet>“): the active planet
  researches; a line shows its lab level and, with IFN, how many labs may
  join; the research time names the summed level („Labore zusammen Stufe
  16“) when other labs join; the running research names its planet. Without
  a lab the view offers the own planets that have one. Gravitonforschung
  shows the energy production as a cost with the energy icon and „Zu wenig
  Energie: es fehlen …“ instead of the button.
* **[V]** Requirements list ([Requirements list](/features/requirements.md)):
  everything is built and researched on the shown planet; a ready research
  need that lacks energy says „zu wenig Energie“.
* Icons from the interface v2 set: `ion_technology.svg`,
  `plasma_technology.svg`, `graviton_technology.svg`,
  `intergalactic_research_network.svg`.
* Like every research, the four get the level achievements automatically;
  those of Gravitonforschung reward nothing, because it costs no resources
  and the reward is 5 % of the level cost.
* Tests: `src/shared/research.test.ts`, `requirements.test.ts`,
  `catalog.test.ts`, `src/server/game/actions.test.ts`,
  `src/server/game/fleet.test.ts` (state), `src/client/logic/game.test.ts`,
  `migration-10.test.ts`; E2E „from a colony the lab is built on the colony
  itself“, „research starts on a colony with its own lab and is paid
  there“, „the research network (IFN) links a colony lab and shortens
  research“, „Gravitonforschung needs 300,000 energy production“ (#49). The
  equivalence test with version 1 compares only the research of version 1.
