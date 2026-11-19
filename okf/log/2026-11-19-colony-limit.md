---
type: log-entry
date: 2026-11-19T19:00
kind: Feature
issues: [237]
---

#237 built with the owner's „Geklärt“ of 2026-11-17 (D1 to D6): the admin sets for each round the most planets per player (0 = unlimited, the home planet counts, moons do not) and may switch on the research „Kolonialverwaltung“ (`colonial`), which adds planets per level up to a highest level; four live settings in one fieldset „Planetengrenze“ (`src/core/colony-limit.ts`, orders 440 to 470), refused together (research on with a base of 0) by a new optional entry rule `agrees` of the registry, in „Neue Runde“ and in the live settings. A Landnahme reserves a slot at the launch and is checked again at the arrival with the research of that moment; at the limit the whole fleet returns with its ark and cargo. [V]: no limit above 20 planets in total, the ranges 0 to 20 / 1 to 20 / 0 to 20, the defaults (no limit, research off, +2, highest level 4: today's game), cost and requirements of the research (the Kreuzzugs-Kartografie's), the words of the refusal, the report and the lines in the overview and the fleet form. Not built yet: hiding the research in the research list while a round does not have it and its level line (the research view belongs to another branch; the server refuses it meanwhile), the preview and the hidden fields of the dialog. See [Colonization](/features/colonization.md#planet-limit-per-player-237).
