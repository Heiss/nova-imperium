---
type: log-entry
date: 2026-11-20T04:00
kind: Code
issues: [235]
---

From the update of 2026-11-22 the events of a running round are written as round events (owner, 2026-11-20, #235), so the next round gets the full Rewind and the curves. The capture is central at the two entry points: `runAction` writes one `journal.action` per game action (a refused one as refused), `tick` one `journal.arrival`, `journal.hold` or `journal.return` per fleet, and a player's first place writes `participant.joined` with the seat and the baseline. The input of an action is stored by an allow-list per field (passwords and free texts never, account ids as seats), what the saved places produced is derived at their save, and the numbers of a battle are copied once from its report. No feature file is edited. See [Round archive](/features/round-archive.md), section „The events of a running round“.
