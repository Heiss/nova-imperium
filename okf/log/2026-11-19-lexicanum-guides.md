---
type: log-entry
date: 2026-11-19T21:00
kind: Decision and code
issues: [289, 288]
---

#289, stage 3 of the Lexicanum: the guides „Erste Schritte“, „Deine erste Kolonie“, „Deine erste Flotte“ and „Dich verteidigen“ and the personal page „Deine nächsten Ziele“, the first box „Einstieg“ of the start page. The open decisions D1 to D3 were taken as recommended [V] (Claude drafts the guides, the personal page from rules only, four guides). The hints are pure functions of the own state (`src/core/lexicon/hints.ts`): energy that is short, a store that is full, no free field, every fleet slot in use, the limit of planets, a requirement one level away, and a planet without a mine; the browser already holds that state, so no part of the server was added. The texts are drafts [V] in the review list [Lexicanum texts](/features/lexicanum-texts.md); see [Lexicanum](/features/lexicanum.md) and the rule pages of #288.
