---
type: feature
title: Changelog in the game
description: „Neuigkeiten“ for players from CHANGELOG.md, the update message after a release and the hint on unread news.
---

# Changelog in the game

Issue #81. Decisions of the owner on 2026-11-12. The texts come from the
release flow ([Branching and release](/ops/branching-release.md)): one German
fragment per pull request, bundled into `CHANGELOG.md` by the release pull
request and baked into the image with it.

* **[E]** Source: `CHANGELOG.md` of the released commit, German, for players;
  a section per version („## Version 26.11.19 – 12.11.2026“) with „Neu“,
  „Geändert“, „Behoben“.
* **[E]** Claude writes the texts in German and checks that they match the
  pull request; the release pull request checks them again.
* **[E]** Players see the version number with the date („Version 26.11.19 –
  12.11.2026“).
* **[E]** After an update, every player gets one message per rolled-out
  version: a hint plus the first three entries of the versions since the
  one that ran before, with a link to „Neuigkeiten“; an update without
  entries sends none. The server knows the version that ran before, so a jump
  from an older release shows everything in between.
* **[E]** A dot on the menu item „Neuigkeiten“ until it is opened, stored per
  device in the browser (no migration).
* **[V]** Order of the entries and „first three“: new before changed before
  fixed, within a kind by file name (`scripts/changelog.ts`).
* **[V]** The image gets its version as a build argument; the server keeps
  the version that ran before in the `settings` table.

Not built yet: the page „Neuigkeiten“, the update message and the dot follow
in their own pull request.
