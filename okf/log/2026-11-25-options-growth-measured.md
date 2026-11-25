---
type: log-entry
date: 2026-11-25T14:00
kind: Decision
issues: [360, 356]
---

„Optionen“: two boxes that grow once when the page is opened (#360), measured again after #356 (owner, 2026-11-24, 76a) and closed without a change (owner, 2026-11-25, 83a). The probe was not committed. It held `/api/own-activity` and the archive's `/api/action` until „Optionen“ was open in a section, then let them go.

| Where | Section | Before the load | #own-activity top before → after | scrollY before → after |
| --- | --- | --- | --- | --- |
| Desktop 1280×800 | Spiel, Konto, Gerät, Weiteres | scrolled to the middle | hidden, 0 → 0 | unchanged |
| Desktop 1280×800 | Runde | scrolled to the middle | 451 → 467 | 18 → 18 |
| Desktop 1280×700 | Runde | scrolled to the end | 413 → 429 | unchanged |
| Desktop 1280×600 | Runde | scrolled to the end | 313 → 329 | unchanged |
| Desktop 1280×500 | Runde | scrolled to the end | 213 → 229 | unchanged |
| Desktop 1280×400 | Runde | scrolled to the end | 113 → 129 | unchanged |
| Desktop 1280×320 | Runde | scrolled to the end | 33 → −553 | 436 → 1038 |
| Phone 839 px high | Runde | at the top | 699 → 715 | 0 → 0 |
| Phone 839 px high | Runde | scrolled to the end | 482 → 498 | 217 → 217 |

In every case but one the growth stays below the visible top. The exception is a desktop window about 320 px high, scrolled to the end of „Runde“ while the load is pending: the box starts under the sticky header (its bottom at about 72 px), so it grows above the visible part. Chromium's scroll anchoring keeps the content in place there (scrollY 436 → 1038); Safari would move it once. The owner closed the issue with this table and no code.
