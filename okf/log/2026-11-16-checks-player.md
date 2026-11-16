---
type: log-entry
date: 2026-11-16T20:24
kind: Code
issues: [214]
---

#214, the player pull request: the check of `rename` is the pure function `planetNameError` of the new `core/planet-name.ts` (code `empty`, the name cleaned and cut already), worded by the server from a table (`RENAME_ERROR`, „Bitte einen Namen eingeben.“, unchanged) and asked by the dialog „umbenennen“, which still sends nothing and shows no note when it refuses; the length 20 is `MAX_PLANET_NAME` for the server's cut and the dialog's `maxlength`. `options` and `pushOptions` already follow section 7 of [Design patterns](/architecture/patterns.md), and `read`, `delrep` and `delall` have no rule to move; no finding belongs to the player group, so no text changes and the label is `kein-changelog`; unit and property tests of the check, server tests of the message, the cut and the order before the planet, an E2E test that an empty name sends nothing (see [Checks of the server actions](/architecture/action-checks.md)).
