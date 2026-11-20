---
type: log-entry
date: 2026-11-20T01:30
kind: Code
issues: [189]
---

The new E2E spec `e2e/phone-lists.spec.ts` found that the fleet view was wider than a 360 px phone (#189, D7) as soon as the player had two kinds of ship that can fly: the ship table of „1. Schiffe auswählen“ reached 383 px (four columns, count field 90 px). `input.fs` is 52 px in the phone block of `src/client/static/style.css`; `src/test/phone-css.test.ts` pins the rule. The same spec checks that the four build lists have no axe violations on a phone. See [Interface](/features/interface.md).
