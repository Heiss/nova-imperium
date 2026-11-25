---
type: log-entry
date: 2026-11-24T17:30
kind: Code
issues: [374, 351, 191]
---

A server feature says whether it is on in the round (#374, part of the foundation of v3, #351; a refactor without a change of behaviour). `ServerFeature.enabled(round)` with its refusal `off` replaces the group `guildActions` (#191): `runAction` refuses an action of a feature that is off with its `off`, and every key of its state part is null. Guilds, guild ranks and the guild chat use it; `dispatch.ts` no longer refuses guild actions by name. Tests: the behaviour tests of the guilds are unchanged; the group cases of `src/server/game/registry.test.ts` became cases of the switch (the coordinator took this as [V]), with new ones: every action of a feature that is off is refused with its refusal and its state keys are null; a switch without a refusal stops the start; a switched part builds while on and is null while off.
