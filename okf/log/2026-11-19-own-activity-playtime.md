---
type: log-entry
date: 2026-11-19T19:00
kind: Code
issues: [232, 231, 229, 235]
---

#232 and #231 built together, in this order. The measurement: the page reports `{ instance, seq, state, since }` to `POST /api/playtime` (a start on the first trusted click, key or scroll, a heartbeat every 30 s while active, a stop after 60 s without an interaction and when the page is hidden or loses the focus); `judge` in `src/core/playtime.ts` turns each report into an accepted interval, bounded by the 30 s heartbeat and the time the server has seen, never bridging a gap. The accepted intervals are the rows of the append-only table `playtime_events`; every total (day, round, account) is derived on read as the union of the intervals, so no statistics are stored. The view: „Meine Aktivität & Spielzeit“ in „Hilfe & Optionen“ reads `GET /api/own-activity` (the account from the session). The admin diagnostics use the same sums; `activity()` and the writing of `player_activity` are gone, `POST /api/activity` only sets the public activity of #229 as before. See [Own activity and play time](/features/own-activity.md), which names the table and its columns for the archived round reports (#235). Three tests of the old method were removed with it (`audit.test.ts`, `admin.test.ts`).
