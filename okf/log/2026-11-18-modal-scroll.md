---
type: log-entry
date: 2026-11-18T17:55
kind: Fix
issues: [228, 229]
---

#228 merged with #229: the dialog „Neue Runde“ now holds the groups „Aktivität“ (#229) and „Fremde Flotten erkennen“ (#228), so on a screen of 720 px height its buttons lay outside the window and could not be reached; every dialog (`#modal .in`) is now at most as high as the window and scrolls inside itself (see [Admin](/features/admin.md)).
