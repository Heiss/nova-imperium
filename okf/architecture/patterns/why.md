---
type: Architecture
title: 'Why the patterns'
description: 'The mechanics the planned features have in common, and the goals the owner chose for the patterns.'
---

# Why

The open issues bring the same kinds of rules again and again (read on
2026-11-12: #21, #45 to #47, #49 to #60, #63, #78, #93 to #95):

| Mechanic | Issues |
|---|---|
| Producers and consumers with their own formula (temperature, research, share) | #46, #47, #52 |
| Energy as a threshold: produced, not consumed | #49 (Gravitonforschung), #51 (Terraformer) |
| Limits: once per planet, fields taken or given, silo slots, planet or moon only | #50, #51, #53, #54 |
| Values that depend on research (drive change) | #57, #58 |
| A unit that never flies but fights | #46 |
| New missions with their own conditions | #45, #55, #93, #95; #54 (missiles, no fleet) |
| New places: moon, debris field, position 16 | #45, #53, #93 |
| Battle with several parties and consequences (debris, moon chance, missiles) | #45, #53, #54, #55 |
| Texts apart from rules (renaming, long explanations) | #63, #94 |
| Points per category | #78 |
| Admin parameters of rules | #45 D2, #51 D4 |

Without a pattern each of them becomes an `if (key === …)` in a shared
file, and parallel pull requests collide in `src/core/catalog.ts`.

**[E]** The owner chose the goals (2026-11-12): reuse inside Nova Imperium
only (no package for other projects); all layers (rules, game, store,
client); Svelte stays the client direction; fast iteration means parallel
work without merge conflicts and small pull requests. The owner left the
choice of the patterns to the assistant's recommendation below
(2026-11-12).
