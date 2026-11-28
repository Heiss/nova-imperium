---
type: log-entry
date: 2026-11-28T08:30
kind: Code
issues: [358]
---

Admin explanations, part 2 (#358): the 23 settings with a formula behind them get the field „Eigener Wert“ under their table [V]. The admin types a value of his own with the rules of the setting's field; the table shows a column more for it, computed with the functions of `src/core` as every other column. A value outside the range is refused with the server's words and adds no column; one the rules between settings refuse shows „–“ with their words. The value is never saved and is gone when the panel closes. The other 11 tables stay static: their values follow by a threshold or are few.
