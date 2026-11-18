---
type: log-entry
date: 2026-11-18T22:15
kind: Code
issues: [310, 283, 228, 202, 223, 55]
---

#310, the owner's design pattern against the conflicts of parallel feature branches (2026-11-18), built without a visible change: a feature defines the settings of a round in its own file of `src/core` and exports them as `roundSettings`; `scripts/gen-features.ts` lists these files in `src/core/round-settings.gen.ts` (not checked in, like the feature index), and `src/core/round.ts` builds the registry `ROUND_SETTINGS` of #283 from that list and names no feature. [V] The tests follow the split: one test (`src/core/round-registry.test.ts`) checks the rules for all entries without naming a feature or a count, every feature tests its own entries by key or group, and the fixtures that need a full set of values take it from `roundDefaults()` (`src/test/fixtures.ts`). Adding a setting, as #228, #202, #223 and #55 will, touches only the feature's own files. The other shared lists that conflict (`mutation-standard.json`, `size-ratchet.json`, the action list of `src/server/game/dispatch.ts`, `e2e/seed.ts`) are analysed in the pull request, not changed (see [Admin](/features/admin.md#the-registry-of-the-round-settings-283), [Briefs for subagents](/ops/subagent-briefs.md)).
