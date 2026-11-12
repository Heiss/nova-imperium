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
