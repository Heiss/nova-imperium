---
type: Policy
title: 'Tests of missions'
description: 'Contract tests of the missions as strategies (#116).'
---

# Tests of missions

* **[E]** Missions as strategies (#116, owner, 2026-11-14): contract tests
  for the rules of every mission (`src/core/missions.test.ts`) and for its
  server part (`src/server/game/missions.test.ts`) read the generated
  indexes, so a new mission is checked without new test code; each mission
  folder tests its own `canSend` and `onArrive` with a seeded random
  generator and a fixed clock. The property test
  `src/server/game/missions-reference.test.ts` keeps sending, the arrival
  and the coming home bit-identical to the code before #116 (a frozen copy
  of `arrival.ts` and of the sending part of `fleet-actions.ts`): on 400
  generated worlds and fleets (fixed fast-check seed 116) it builds two
  equal databases in memory, runs both versions, and compares the answer or
  message, every table and the next random number; a third case checks
  that the generated cases reach every message and every arrival. Since
  #45 it generates the five missions and the ships it knew (the Bergung and
  the Bergungsbarke have their own tests), and its frozen reference has the
  debris rule of #45, written there on its own: 30 % of the Adamant and
  Psikristall of the ships both sides lost, Sonnenreliquiare included, no
  defense, no Promethium, added to the field at the position, and the field
  `debris` of both battle reports. So it compares every table and report
  bit for bit again, debris rows included, and fails when the rule in the
  code changes (owner, 2026-11-14, #45). It also checks the debris on its
  own (exactly the debris of the losses the report lists, only a battle
  leaves a field) and that the generated battles leave fields. Since #53 its
  frozen reference has the moon rule too, written there on its own: at a
  planet without a moon the chance ⌊(Adamant + Psikristall of the whole
  field) / 100,000⌋ %, at most 20, one draw, on a hit a second draw for the
  diameter and the moon row, and the report fields `moonChance` and `moon`;
  it compares everything bit for bit and checks that the generated battles
  roll chances and form moons (owner, 2026-11-14, #53).
