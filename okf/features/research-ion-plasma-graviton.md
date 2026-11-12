---
type: feature
title: Ionentechnik, Plasmatechnik and Gravitonforschung
description: The research added by issue #49, its values, the energy check of Gravitonforschung and what stays out.
---

# Ionentechnik, Plasmatechnik and Gravitonforschung

Issue #49, milestone `next release` with #46, #47 and #50 (owner, 2026-11-12).
Not in version 1; the classic values of the issue, confirmed by the owner as
they are (2026-11-12).

* **[E]** Scope: Ionentechnik, Plasmatechnik and Gravitonforschung. The
  Intergalaktisches Forschungsnetzwerk stays out of this release; research
  keeps running on the home planet ([Colony ships](/features/colonization.md))
  (owner, 2026-11-12).
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
