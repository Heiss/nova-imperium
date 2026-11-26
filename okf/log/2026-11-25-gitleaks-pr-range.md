---
type: log-entry
date: 2026-11-25T22:45
kind: Fix
issues: [401]
---

gitleaks in CI scans the commits of a pull request only. It scanned every fetched ref, so a test password on the unmerged branch of #401 made the job „Secrets and dependencies“ fail on every pull request. A pull request now passes the range of its base and head commit to gitleaks (as data from the event, not written into the script); a push and the nightly run still scan the whole history of all refs. The findings are shown with their file and line, the values stay redacted.
