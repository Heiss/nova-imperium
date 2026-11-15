---
type: log-entry
date: 2026-11-06
kind: Fix
---

(found while porting): opening an invitation link in a tab that is already open did nothing (only the hash changes); a cookie part with a leading space gave an empty name; a too large request closed the connection instead of answering 400.
