---
type: log-entry
date: 2026-11-17T06:40
kind: Decision
issues: [205, 206, 270]
---

New admin settings and admin actions are new features and belong in the changelog (owner, 2026-11-17): the fragment of their feature names briefly what the admin can now do; the loop writes it so in every pull request and checks it in the texts of the release pull request; the CI check „Changelog fragments“ now also requires a fragment for changes in `src/server/http`, where the admin routes are. The fragments of the coming release lacked three of them: the default flight time of the „Endzeit“ (#205), „Mond anlegen“ (#206) and the lock of the main planet per round (#270) (see [Branching and release](/ops/branching-release.md), [Release loop](/ops/loop.md)).
