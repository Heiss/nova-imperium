---
type: log-entry
date: 2026-11-21T17:30
kind: Code
issues: [126]
---

#126, a defect of the push run of the release 26.11.23 (coordinator, 2026-11-21): „Problem melden“ of an error message could name another call than the failed one. The transport set the id of every answer as the last one, also while the body of a failed answer was still being read, and the note took that last id when it was shown; the poll of the state answering in between put its own id into the dialog („Letzter Vorgang“), while the message itself named the right one. The transport now throws an `ApiError` that carries the id of its own call (`requestIdOf`), every error message of a call hands the note that error, and the note names its call, or none for a message of the page itself; the last id of any call stays for the form in „Hilfe & Optionen“, where the last one is meant. Tests: the transport with the poll answering while the body of a failure is read, the action handing the note its error, the note itself, and the E2E cases of `e2e/error-log.spec.ts` that now let the poll answer before „Problem melden“ is opened. Not visible to players (the id is for the admin): no changelog fragment.
