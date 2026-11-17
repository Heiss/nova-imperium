---
type: feature
title: Own activity and play time
description: The private statistics „Meine Aktivität & Spielzeit“ in „Hilfe & Optionen“, how they count across rounds and days, how long they are kept and when a new session starts (issues #231 and #232).
---

# Own activity and play time

Issues #231 (the view in „Hilfe & Optionen“ → „Meine Aktivität &
Spielzeit“) and #232 (the measurement of the play time), part of the
Classic features (#222). They change no game rule. #231 D1 to D3 and the
model of #232 (states, scroll and focus, a heartbeat every 30 s, a
timeout of 60 s) are decided in the issues; the public activity markers
are [Activity indicators](/features/activity-indicators.md).

# Decisions

* **[E]** Counting (owner, 2026-11-16, #231 D4): sums per account and per
  round, days in UTC; the data stay across the round reset.
* **[E]** Retention (owner, 2026-11-16, #231 Q1): as long as the round
  archives (#235); the view shows since when it records („Erfasst seit …“).
* **[E]** Sessions (owner, 2026-11-16, #232 Q1): a new session starts after
  a pause of 30 minutes.
