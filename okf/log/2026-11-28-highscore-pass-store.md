---
type: log-entry
date: 2026-11-28T13:30
kind: Code
issues: [491]
---

The highscore pass is stored in the database (owner, 2026-11-28, #491): a restart of the server read only its memory and made a new pass at the first reader, outside the schedule. Now every new pass is written to the table `score_pass` (one row: the round, the time, the totals and categories), and after a restart the stored pass is taken while it holds, so the ranks and the „Stand“ stay until the next scheduled pass. Live passes are stored too; a new round empties the table and stores its own pass. The changelog text is a proposal [V].
