---
type: log-entry
date: 2026-11-26T12:40
kind: Fix
issues: [407]
---

Of the „alles“ buttons under the cargo fields (#407) only the newest stays computed: a click on another „alles“ keeps the earlier field at the number it showed, as „alles (gleichmäßig)“ already does. The server computes that one field again at the launch; the other fields are checked like typed numbers. The preview no longer drifts when it is computed again, and the launch loads what the form showed.
